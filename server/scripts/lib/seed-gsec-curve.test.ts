import { gsecCurveConfigSchema } from '@server/lib/gsec-curve-config';
import { createCcilCurveSnapshot, fetchGsecCurveSeed, parseCcilNssHtml } from '@server/scripts/lib/seed-gsec-curve';
import { afterEach, describe, expect, it, vi } from 'vitest';

const row =
  '<tr><td>2026-10-08 00:00:00.0</td><td>8.27</td><td>-2.9928</td><td>-19.9674</td><td>19.5976</td><td>2.0618</td><td>1.8925</td></tr>';
const html = `<table id="advancedSearch"><thead><tr><th>Date</th><th>ß0</th><th>ß1</th><th>ß2</th><th>ß3</th><th>tau1</th><th>tau2</th></tr></thead><tbody>${row}${row.replace('2026-10-08', '2026-10-07')}</tbody></table>`;
const config = gsecCurveConfigSchema.parse({});
afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

describe('daily public CCIL adapter', () => {
  it('parses the dated six-parameter table rather than an unrelated HTML number', () => {
    const rows = parseCcilNssHtml(`<table><tr><td>999</td></tr></table>${html}`);
    expect(rows.map((row) => row.referenceDate)).toEqual(['2026-10-08', '2026-10-07']);
    expect(rows[0]!.parameters).toEqual({
      beta0: 8.27,
      beta1: -2.9928,
      beta2: -19.9674,
      beta3: 19.5976,
      tau1: 2.0618,
      tau2: 1.8925,
    });
    const snapshot = createCcilCurveSnapshot(html, '2026-10-09T02:00:00.000Z', config);
    expect(snapshot).toMatchObject({
      referenceDate: '2026-10-08',
      publicationTimestamp: null,
      firstObservedAt: '2026-10-09T02:00:00.000Z',
      compounding: 'continuous',
      dayCount: 'ACT/365',
      minTenor: 0,
      maxTenor: 50,
    });
    expect(createCcilCurveSnapshot(html, '2026-10-10T02:00:00.000Z', config).id).toBe(snapshot.id);
    expect(createCcilCurveSnapshot(html.replace('8.27', '8.28'), '2026-10-09T02:00:00.000Z', config).id).not.toBe(
      snapshot.id
    );
  });

  it('accepts encoded beta headings, whitespace, nested spans and reverse source date order', () => {
    const modified = html.replaceAll('ß', '&szlig;').replace('<td>8.27</td>', '<td> <span>8.27</span>&nbsp; </td>');
    expect(parseCcilNssHtml(modified)[0]!.parameters.beta0).toBe(8.27);
    expect(parseCcilNssHtml(html.replace(row, '').replace('</tbody>', `${row}</tbody>`))[0]!.referenceDate).toBe(
      '2026-10-08'
    );
  });

  it('normalizes the DD-MM-YYYY format returned by CCIL to Node without month/day ambiguity', () => {
    const nodeHtml = html.replace('2026-10-08 00:00:00.0', '08-10-2026').replace('2026-10-07 00:00:00.0', '07-10-2026');
    expect(parseCcilNssHtml(nodeHtml)).toEqual(parseCcilNssHtml(html));
    expect(() => parseCcilNssHtml(html.replace('2026-10-08 00:00:00.0', '10/08/2026'))).toThrow();
  });

  it.each([
    ['missing table', '<html>Access denied</html>'],
    ['duplicate tables', html + html],
    ['changed headings', html.replace('tau1', 'tau3')],
    ['blank parameter', html.replace('<td>8.27</td>', '<td></td>')],
    ['non-numeric parameter', html.replace('8.27', 'NaN')],
    ['non-finite parameter', html.replace('8.27', '1e999')],
    ['zero tau', html.replace('2.0618', '0')],
    ['invalid date', html.replace('2026-10-08', '2026-02-30')],
    ['conflicting duplicates', html.replace('</tbody>', `${row.replace('8.27', '8.28')}</tbody>`)],
  ])('fails closed on %s', (_, invalidHtml) => {
    expect(() => parseCcilNssHtml(invalidHtml)).toThrow();
  });
  it('rejects future data and never assigns an invented publication time', () => {
    expect(() => createCcilCurveSnapshot(html, '2026-10-07T02:00:00.000Z', config)).toThrow('future-dated');
    expect(createCcilCurveSnapshot(html, '2026-10-09T02:00:00.000Z', config).publicationTimestamp).toBeNull();
  });

  it('makes one unauthenticated request during seeding and preserves explicit conventions', async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-10-09T02:00:00.000Z'));
    const request = vi
      .fn()
      .mockResolvedValue(new Response(html, { headers: { 'content-type': 'text/html;charset=UTF-8' } }));
    vi.stubGlobal('fetch', request);
    const seed = await fetchGsecCurveSeed(config);
    expect(request).toHaveBeenCalledTimes(1);
    expect(request.mock.calls[0]![0]).toBe('https://www.ccilindia.com/zcyc-parameters');
    expect(request.mock.calls[0]![1]).toEqual({ signal: expect.any(AbortSignal) });
    expect(seed).toMatchObject({ day: '2026-10-09', error: null, snapshot: { referenceDate: '2026-10-08' } });
  });

  it.each([
    new Response('Unavailable', { status: 503 }),
    new Response('{}', { headers: { 'content-type': 'application/json' } }),
    new Response('Login required', { headers: { 'content-type': 'text/html' } }),
  ])('returns a curve-only failure instead of aborting the main daily seed', async (response) => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(response));
    const seed = await fetchGsecCurveSeed(config);
    expect(seed.snapshot).toBeNull();
    expect(seed.error).toBeTruthy();
  });
  it('handles network timeout without retries or fabricated parameters', async () => {
    const request = vi.fn().mockRejectedValue(new Error('request timed out'));
    vi.stubGlobal('fetch', request);
    expect(await fetchGsecCurveSeed(config)).toMatchObject({ snapshot: null, error: 'request timed out' });
    expect(request).toHaveBeenCalledTimes(1);
  });
});
