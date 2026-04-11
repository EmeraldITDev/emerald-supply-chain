

# Acknowledged — `items: any[]` Type Boundary

The observation is valid. The `items: any[]` field in `NormalizedQuotation` is a pragmatic compromise — quotation line items have inconsistent shapes from the backend and typing them now would add scope without immediate benefit.

**What changes in the implementation:**

A `// TODO:` comment will be added above the `items` field in the `NormalizedQuotation` interface:

```ts
// TODO: Type this as NormalizedQuotationItem[] once line item shape stabilizes from backend
items: any[];
```

This marks the `any` boundary explicitly so future developers know where to tighten the type. No other changes to the plan.

**Ready to execute all four files as specified in the revised plan.**

