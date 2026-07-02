import { getEmeraldPoLogoPublicPath, type EmeraldPoDisplayModel } from '@/utils/emeraldPoDocumentModel';
import { formatPoAmount } from '@/utils/currency';

/**
 * On-screen / print preview matching the Emerald Purchase Order reference layout.
 */
export function EmeraldPurchaseOrderPreview({ model }: { model: EmeraldPoDisplayModel }) {
  const fmt = (n: number) => formatPoAmount(n, model.currencyCode);
  return (
    <div className="emerald-po-preview rounded-md border border-border bg-white p-6 text-black shadow-sm print:shadow-none print:border-0">
        <div className="flex justify-between gap-6 border-b border-slate-200 pb-5">
        <div className="min-w-0 flex-1 space-y-1.5 text-sm pr-2">
          <p className="text-base font-bold">{model.companyName}</p>
          {model.companyAddressLines.map((line) => (
            <p key={line} className="text-slate-800">
              {line}
            </p>
          ))}
          <p className="text-slate-800">{model.companyEmail}</p>
          <a href={model.companyWebsite} className="text-blue-700 underline text-sm break-all">
            {model.companyWebsite}
          </a>
        </div>
        <img
          src={getEmeraldPoLogoPublicPath()}
          alt="Emerald Industrial Co. FZE"
          className="h-[92px] w-auto max-w-[min(240px,46%)] shrink-0 object-contain object-right ml-4 mt-0.5"
        />
      </div>

      <h2 className="mt-4 text-2xl font-normal tracking-tight text-[#4696b9]">Purchase Order</h2>

      <div className="mt-4 grid grid-cols-1 gap-4 border-b border-slate-300 pb-4 text-sm md:grid-cols-3">
        <div>
          <p className="text-xs font-bold text-slate-700">SUPPLIER</p>
          <p className="mt-1 font-medium">{model.supplierName}</p>
        </div>
        <div>
          <p className="text-xs font-bold text-slate-700">SHIP TO</p>
          <p className="mt-1 text-slate-800">{model.shipTo}</p>
        </div>
        <div className="text-sm">
          <p className="text-xs font-bold text-slate-700">P.O. NO.</p>
          <p className="mt-1 font-semibold">{model.poNumber}</p>
          <p className="mt-3 text-xs font-bold text-slate-700">DATE</p>
          <p className="mt-1">{model.poDateDisplay}</p>
        </div>
      </div>

      <div className="mt-4 overflow-x-auto">
        <table className="w-full border-collapse text-sm">
          <thead>
            <tr className="bg-[#c8e4f0] text-left text-xs font-bold text-slate-700">
              <th className="px-2 py-2 w-[22%]"> </th>
              <th className="px-2 py-2">DESCRIPTION</th>
              <th className="px-2 py-2 text-right w-12">QTY</th>
              <th className="px-2 py-2 text-right">RATE</th>
              <th className="px-2 py-2 text-right">TAX</th>
              <th className="px-2 py-2 text-right">AMOUNT</th>
            </tr>
          </thead>
          <tbody>
            {model.lineItems.map((item, idx) => (
              <tr key={idx} className="border-b border-slate-200">
                <td className="px-2 py-2 align-top text-xs font-bold">{item.categoryLine}</td>
                <td className="px-2 py-2 align-top">{item.description}</td>
                <td className="px-2 py-2 text-right tabular-nums">{item.qty}</td>
                <td className="px-2 py-2 text-right tabular-nums">
                  {fmt(item.rate)}
                </td>
                <td className="px-2 py-2 text-right">{item.taxLabel}</td>
                <td className="px-2 py-2 text-right tabular-nums font-medium">
                  {fmt(item.amount)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="my-4 border-t border-dotted border-slate-400" />

      <div className="flex flex-col gap-6 md:flex-row md:items-start md:justify-between">
        <div className="max-w-md flex-1 space-y-2 text-sm">
          <p className="text-slate-800">{model.invoiceSubmissionLine}</p>
          <p className="pt-2 font-bold">Standard terms:</p>
          <ul className="space-y-1 pl-0 text-slate-800 list-none">
            {model.standardTermsLines.map((t) => (
              <li key={t} className="pl-0">
                - {t}
              </li>
            ))}
          </ul>
          {model.paymentMilestones && model.paymentMilestones.length > 0 ? (
            <div className="pt-2">
              <p className="font-bold">Payment Schedule:</p>
              <table className="mt-1 w-full border-collapse text-xs">
                <thead>
                  <tr className="bg-slate-100 text-left">
                    <th className="border border-slate-300 px-2 py-1 w-8">#</th>
                    <th className="border border-slate-300 px-2 py-1">Milestone</th>
                    <th className="border border-slate-300 px-2 py-1 text-right w-12">%</th>
                    <th className="border border-slate-300 px-2 py-1 text-right">Amount</th>
                    <th className="border border-slate-300 px-2 py-1">Trigger</th>
                  </tr>
                </thead>
                <tbody>
                  {model.paymentMilestones.map((m) => (
                    <tr key={m.milestoneNumber}>
                      <td className="border border-slate-300 px-2 py-1 tabular-nums">{m.milestoneNumber}</td>
                      <td className="border border-slate-300 px-2 py-1">{m.label}</td>
                      <td className="border border-slate-300 px-2 py-1 text-right tabular-nums">{m.percentage}</td>
                      <td className="border border-slate-300 px-2 py-1 text-right tabular-nums">
                        {fmt(m.amount)}
                      </td>
                      <td className="border border-slate-300 px-2 py-1">{m.triggerLabel}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <p className="pt-2 flex flex-wrap items-baseline gap-x-2 gap-y-1">
              <span className="font-bold shrink-0">Payment Terms:</span>
              <span className="text-slate-800 pl-1">{model.paymentTermsDisplay}</span>
            </p>
          )}
          <p className="pt-2 flex flex-wrap items-baseline gap-x-2 gap-y-1">
            <span className="font-bold shrink-0">Contract type:</span>
            <span className="text-slate-800 pl-1">{model.contractTypeDisplay}</span>
          </p>
        </div>

        <table className="w-full shrink-0 border-collapse text-sm md:w-[220px]">
          <tbody>
            <tr>
              <td className="border border-black px-2 py-1.5 font-bold">SUBTOTAL</td>
              <td className="border border-black px-2 py-1.5 text-right tabular-nums">
                {fmt(model.subtotal)}
              </td>
            </tr>
            <tr>
              <td className="border border-black px-2 py-1.5 font-bold">TAX</td>
              <td className="border border-black px-2 py-1.5 text-right tabular-nums">
                {fmt(model.taxAmount)}
              </td>
            </tr>
            <tr className="bg-slate-200">
              <td className="border border-black px-2 py-1.5 font-bold">TOTAL {model.currencyCode}</td>
              <td className="border border-black px-2 py-1.5 text-right font-bold tabular-nums">
                {fmt(model.total)}
              </td>
            </tr>
          </tbody>
        </table>
      </div>

      <div className="mt-10 max-w-xs space-y-6 text-sm">
        <div>
          <p className="font-bold">Approved By</p>
          <p className="mt-2 font-medium">{model.approverName}</p>
          <div className="relative mt-2 h-16 border-b border-black">
            {model.signatureDataUrl ? (
              <img
                src={model.signatureDataUrl}
                alt="Signature"
                className="pointer-events-none absolute bottom-0 left-1/2 max-h-14 max-w-[12rem] -translate-x-1/2 object-contain object-bottom"
              />
            ) : null}
          </div>
        </div>
        <div>
          <p className="font-bold">Date</p>
          <p className="mt-2">{model.approvalDateDisplay}</p>
          <div className="mt-1 h-6 border-b border-black" />
        </div>
      </div>
    </div>
  );
}
