import { BondCardPanel, bondTableClassName } from '@client/components/gsecs/bond-card-panel';
import { formatBondDate, formatMoney, formatPercent } from '@client/components/gsecs/gsec-format';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@client/components/ui/table';
import type { GsecCarry, GsecRow } from '@shared/types/gsecs';
import { LayersIcon, TrendingUpIcon } from 'lucide-react';

function MaturityNote({ carry }: { carry: GsecCarry[] }) {
  const horizons = carry
    .filter((item) => item.maturesBeforeHorizon)
    .map((item) => (item.months === 12 ? '1Y' : `${item.months}M`));
  return horizons.length ? (
    <p className='text-muted-foreground border-t px-2 py-2 text-xs'>Through maturity at {horizons.join(', ')}</p>
  ) : null;
}

export function BondCardCarry({ row }: { row: GsecRow }) {
  const carry = row.analytics?.carry ?? [];
  const roll = row.curveAnalytics?.carryRoll ?? [];
  return (
    <>
      <BondCardPanel title='Carry at Unchanged YTM' icon={LayersIcon} bodyClassName='p-0'>
        <Table className={bondTableClassName}>
          <TableHeader>
            <TableRow>
              <TableHead>Horizon</TableHead>
              <TableHead>Value date</TableHead>
              <TableHead className='text-right'>Ending price</TableHead>
              <TableHead className='text-right'>Coupons</TableHead>
              <TableHead className='text-right'>Redemption</TableHead>
              <TableHead className='text-right'>Return</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {carry.length ? (
              carry.map((item) => (
                <TableRow key={item.months}>
                  <TableCell className='font-semibold'>{item.months === 12 ? '1Y' : `${item.months}M`}</TableCell>
                  <TableCell>{formatBondDate(item.effectiveHorizonDate)}</TableCell>
                  <TableCell className='text-right'>{formatMoney(item.endingDirtyPrice)}</TableCell>
                  <TableCell className='text-right'>{formatMoney(item.couponsReceived, 3)}</TableCell>
                  <TableCell className='text-right'>{formatMoney(item.redemptionReceived)}</TableCell>
                  <TableCell className='text-right font-semibold'>{formatPercent(item.returnPercent)}</TableCell>
                </TableRow>
              ))
            ) : (
              <TableRow>
                <TableCell colSpan={6} className='text-muted-foreground py-6 text-center'>
                  Carry unavailable.
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
        <MaturityNote carry={carry} />
      </BondCardPanel>

      <BondCardPanel
        title='Carry + Roll'
        icon={TrendingUpIcon}
        bodyClassName='p-0'
        headerDetails={<span className='text-muted-foreground text-xs'>Constant Z-spread</span>}
      >
        <Table className={bondTableClassName}>
          <TableHeader>
            <TableRow>
              <TableHead>Horizon</TableHead>
              <TableHead className='text-right'>Fair price</TableHead>
              <TableHead className='text-right'>Fair YTM</TableHead>
              <TableHead className='text-right'>Assumed YTM</TableHead>
              <TableHead className='text-right'>Ending price</TableHead>
              <TableHead className='text-right'>Return</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {roll.length ? (
              roll.map((item) => (
                <TableRow key={item.months}>
                  <TableCell className='font-semibold'>{item.months === 12 ? '1Y' : `${item.months}M`}</TableCell>
                  <TableCell className='text-right'>{formatMoney(item.fairDirtyPrice, 4)}</TableCell>
                  <TableCell className='text-right'>{formatPercent(item.fairYtm)}</TableCell>
                  <TableCell className='text-right'>{formatPercent(item.assumedYtm)}</TableCell>
                  <TableCell className='text-right'>{formatMoney(item.endingDirtyPrice, 4)}</TableCell>
                  <TableCell className='text-right font-semibold'>{formatPercent(item.returnPercent)}</TableCell>
                </TableRow>
              ))
            ) : (
              <TableRow>
                <TableCell colSpan={6} className='text-muted-foreground py-6 text-center'>
                  {row.curveUnavailableReason ?? 'Carry + roll unavailable.'}
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
        <MaturityNote carry={carry} />
      </BondCardPanel>
    </>
  );
}
