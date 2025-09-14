'use client';

import { Card, CardContent, CardHeader, CardTitle } from './ui/card';
import Image from 'next/image';
import { cn } from '@/lib/utils';

type ReceiptItem = {
  name: string;
  quantity?: number;
  unitPrice?: number | string;
  totalPrice?: number | string;
  category?: string;
};

type ReceiptData = {
  merchantName?: string;
  merchantAddress?: string;
  receiptDate?: string;
  receiptTime?: string;
  receiptNumber?: string;
  subtotal?: number | string;
  tax?: number | string;
  tip?: number | string;
  total?: number | string;
  currency?: string;
  paymentMethod?: string;
  items?: ReceiptItem[];
  imageUrl?: string;
};

export function Receipt({ data, className }: { data: ReceiptData; className?: string }) {
  const items = Array.isArray(data?.items) ? data.items : [];

  return (
    <Card className={cn('w-full overflow-hidden', className)}>
      <CardHeader className="pb-2">
        <CardTitle className="flex items-baseline justify-between text-base">
          <span>{data?.merchantName || 'Receipt'}</span>
          <span className="text-muted-foreground text-xs">
            {data?.receiptDate}
            {data?.receiptTime ? ` • ${data.receiptTime}` : ''}
          </span>
        </CardTitle>
      </CardHeader>
      <CardContent>
        {(() => {
          const Details = (
            <>
              {data?.merchantAddress && (
                <div className="text-muted-foreground">{data.merchantAddress}</div>
              )}

              <div className="rounded-md border">
                <div className="grid grid-cols-5 gap-2 border-b bg-muted/50 px-3 py-2 text-muted-foreground text-xs">
                  <div className="col-span-2">Item</div>
                  <div className="text-right">Qty</div>
                  <div className="text-right">Unit</div>
                  <div className="text-right">Total</div>
                </div>
                <div className="divide-y">
                  {items.length === 0 && (
                    <div className="px-3 py-2 text-muted-foreground text-xs">No items</div>
                  )}
                  {items.map((it, idx) => (
                    <div key={idx} className="grid grid-cols-5 gap-2 px-3 py-2">
                      <div className="col-span-2 truncate" title={it.name}>{it.name}</div>
                      <div className="text-right">{it.quantity ?? ''}</div>
                      <div className="text-right">{it.unitPrice ?? ''}</div>
                      <div className="text-right">{it.totalPrice ?? ''}</div>
                    </div>
                  ))}
                </div>
              </div>

              <div className="ml-auto grid w-full max-w-sm grid-cols-2 gap-y-1 text-sm">
                <div className="text-muted-foreground">Subtotal</div>
                <div className="text-right">{data?.subtotal ?? '-'}</div>
                <div className="text-muted-foreground">Tax</div>
                <div className="text-right">{data?.tax ?? '-'}</div>
                {data?.tip !== undefined && (
                  <>
                    <div className="text-muted-foreground">Tip</div>
                    <div className="text-right">{data.tip}</div>
                  </>
                )}
                <div className="col-span-2 my-1 border-t" />
                <div className="font-medium">Total</div>
                <div className="text-right font-medium">
                  {data?.total ?? '-'} {data?.currency}
                </div>
              </div>

              <div className="flex justify-between text-muted-foreground text-xs">
                <div>Payment: {data?.paymentMethod || '-'}</div>
                {data?.receiptNumber && <div>Receipt #: {data.receiptNumber}</div>}
              </div>
            </>
          );

          if (data?.imageUrl) {
            return (
              <div className="grid items-stretch gap-4 text-sm md:grid-cols-12">
                <div className="md:col-span-5">
                  <div className="relative h-full min-h-[16rem] w-full overflow-hidden rounded-md border bg-muted/30">
                    <Image
                      src={data.imageUrl}
                      alt="Receipt image"
                      fill
                      sizes="(max-width: 640px) 100vw, 640px"
                      className="object-contain"
                      priority={false}
                    />
                  </div>
                </div>
                <div className="md:col-span-7 grid gap-3">{Details}</div>
              </div>
            );
          }

          return <div className="grid gap-3 text-sm">{Details}</div>;
        })()}
      </CardContent>
    </Card>
  );
}

export default Receipt;


