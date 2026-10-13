import { BondCardCarry } from '@client/components/gsecs/bond-card-carry';
import { BondCardPanel, bondTableClassName } from '@client/components/gsecs/bond-card-panel';
import { BondCardSummary } from '@client/components/gsecs/bond-card-summary';
import { CurveChart } from '@client/components/gsecs/curve-chart';
import { formatBondDate, formatMoney, formatPercent, formatSignedPercent } from '@client/components/gsecs/gsec-format';
import { GsecName } from '@client/components/gsecs/gsec-name';
import { ScenarioChart } from '@client/components/gsecs/scenario-chart';
import { SellerDepthTable } from '@client/components/gsecs/seller-depth-table';
import { Button } from '@client/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@client/components/ui/dialog';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@client/components/ui/table';
import { cn } from '@client/lib/utils';
import type { GsecCurvePoint, GsecCurveState } from '@shared/types/gsec-curve';
import type { GsecRow } from '@shared/types/gsecs';
import { ChartNoAxesCombinedIcon, LayersIcon, SlidersHorizontalIcon, UsersIcon } from 'lucide-react';
import { useState } from 'react';

type BondCardProps = {
  row: GsecRow;
  settlementDate: string;
  targetYtm: number | null;
  maxBuyPrice: number | null;
  theoreticalTargetPrice: number | null;
  curve?: GsecCurveState;
  curvePoints: GsecCurvePoint[];
  scenarioBase: number | null;
  scenariosReady: boolean;
};

function BondCard(props: BondCardProps) {
  const { row, settlementDate, curve, curvePoints, scenarioBase, scenariosReady } = props;
  const scenarios = scenariosReady ? (row.analytics?.scenarios ?? []) : [];
  const scenarioMessage =
    scenarioBase === null
      ? 'Invalid scenario base.'
      : row.analytics && !scenariosReady
        ? 'Updating scenarios…'
        : 'Scenarios unavailable.';
  return (
    <>
      <DialogHeader className='shrink-0 gap-1 px-4 pt-4 pr-16 pb-3'>
        <DialogTitle className='flex flex-wrap items-center gap-3 text-2xl font-bold sm:text-3xl'>
          <GsecName listing={row} />
          <span className='border-border bg-muted text-muted-foreground rounded border px-2 py-1 text-xs font-medium'>
            {row.exchange}
          </span>
        </DialogTitle>
        <DialogDescription className='text-xs sm:text-sm'>
          {formatBondDate(row.maturityDate)} · Coupon {(row.coupon / 100).toFixed(2)}% · {row.isin}
        </DialogDescription>
        <p className='text-muted-foreground text-xs'>
          Settlement {formatBondDate(settlementDate)}
          {row.analytics ? ` · Next coupon ${formatBondDate(row.analytics.nextCouponDate)}` : ''}
        </p>
      </DialogHeader>

      <div
        role='region'
        aria-label='Bond details'
        tabIndex={0}
        className='focus-visible:ring-ring min-h-0 flex-1 space-y-3 overflow-y-auto overscroll-contain px-4 pb-3 outline-none focus-visible:ring-2 focus-visible:ring-inset'
      >
        <BondCardSummary
          row={row}
          targetYtm={props.targetYtm}
          maxBuyPrice={props.maxBuyPrice}
          theoreticalTargetPrice={props.theoreticalTargetPrice}
        />

        <div className='grid items-stretch gap-3 lg:grid-cols-[0.95fr_1.05fr]'>
          <BondCardPanel title='Yield Shock Scenarios' icon={SlidersHorizontalIcon} bodyClassName='p-0'>
            <Table className={bondTableClassName}>
              <TableHeader>
                <TableRow>
                  <TableHead>Shock</TableHead>
                  <TableHead className='text-right'>YTM</TableHead>
                  <TableHead className='text-right'>Dirty price</TableHead>
                  <TableHead className='text-right'>Change</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {scenarios.length ? (
                  scenarios.map((item) => (
                    <TableRow
                      key={item.shockBp}
                      className={item.shockBp === scenarioBase ? 'bg-muted/70 font-semibold' : undefined}
                    >
                      <TableCell>
                        {item.shockBp > 0 ? '+' : ''}
                        {item.shockBp} bp
                      </TableCell>
                      <TableCell className='text-right'>{formatPercent(item.yieldPercent)}</TableCell>
                      <TableCell className='text-right'>{formatMoney(item.dirtyPrice)}</TableCell>
                      <TableCell
                        className={cn(
                          'text-right font-semibold',
                          item.priceChangePercent !== null && item.priceChangePercent < 0 && 'text-chart-curve',
                          item.priceChangePercent !== null && item.priceChangePercent > 0 && 'text-success'
                        )}
                      >
                        {formatSignedPercent(item.priceChangePercent)}
                      </TableCell>
                    </TableRow>
                  ))
                ) : (
                  <TableRow>
                    <TableCell colSpan={4} className='text-muted-foreground py-8 text-center'>
                      {scenarioMessage}
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </BondCardPanel>
          <BondCardPanel title='Yield Shock Price Curve' icon={ChartNoAxesCombinedIcon} bodyClassName='p-2'>
            {scenarios.filter((item) => item.dirtyPrice !== null).length > 1 ? (
              <ScenarioChart scenarios={scenarios} scenarioBase={scenarioBase ?? 0} />
            ) : (
              <p className='text-muted-foreground flex min-h-80 items-center justify-center text-sm'>
                {scenarioMessage}
              </p>
            )}
          </BondCardPanel>
        </div>

        <BondCardPanel
          title='Curve'
          icon={LayersIcon}
          bodyClassName='px-2 pt-2 pb-1'
          headerDetails={
            curve?.snapshot ? (
              <span className='text-muted-foreground text-sm'>
                <a
                  href={curve.snapshot.sourceUrl}
                  target='_blank'
                  rel='noreferrer'
                  className='hover:text-foreground underline-offset-4 hover:underline'
                >
                  CCIL NSS
                </a>
                {' · '}
                {formatBondDate(curve.snapshot.referenceDate)}
              </span>
            ) : undefined
          }
        >
          {row.curveAnalytics && curve?.snapshot ? (
            <>
              <CurveChart points={curvePoints} analytics={row.curveAnalytics} marketYtm={row.rrr} />
              {curve.message ? <p className='text-muted-foreground px-2 pb-1 text-xs'>{curve.message}</p> : null}
            </>
          ) : (
            <p className='text-muted-foreground px-2 py-8 text-sm'>
              {row.curveUnavailableReason ?? 'CCIL curve unavailable.'}
            </p>
          )}
        </BondCardPanel>

        <div className='grid items-stretch gap-3 xl:grid-cols-2 2xl:grid-cols-[1.7fr_1.7fr_1fr]'>
          <BondCardCarry row={row} />
          <BondCardPanel
            title='Seller Depth'
            icon={UsersIcon}
            className='xl:col-span-2 2xl:col-span-1'
            bodyClassName='p-0'
          >
            <SellerDepthTable row={row} />
          </BondCardPanel>
        </div>
        {row.masterDataStatus === 'invalid' ? (
          <p className='text-destructive text-sm'>Invalid bond master data.</p>
        ) : null}
      </div>
    </>
  );
}

export function BondCardDialog(props: BondCardProps) {
  const [open, setOpen] = useState(false);
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger
        render={<Button variant='outline' size='sm' className='min-h-10 transition-colors' />}
        aria-label={`Open Bond Card for ${props.row.exchange} ${props.row.tradingsymbol}`}
      >
        Bond Card
      </DialogTrigger>
      <DialogContent
        initialFocus={false}
        className='flex max-h-[calc(100dvh-2rem)] w-[calc(100vw-2rem)] flex-col gap-0 overflow-hidden p-0 sm:max-w-[96rem] [&>[data-slot=dialog-close]]:size-10'
      >
        {open ? <BondCard {...props} /> : null}
      </DialogContent>
    </Dialog>
  );
}
