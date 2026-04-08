# Vendor Registration — cURL Test Guide

Use these commands to test the `POST /api/vendors/register` endpoint with the **exact FormData keys** the frontend sends.

> **Replace** `https://your-api-domain.com/api` with your actual backend URL.

---

## 1. Minimal Registration (Required Fields Only)

```bash
curl -X POST "https://your-api-domain.com/api/vendors/register" \
  -H "Accept: application/json" \
  -F "companyName=Acme Supplies Ltd" \
  -F "category=Raw Materials" \
  -F "email=vendor@acmesupplies.com" \
  -F "phone=+2348012345678" \
  -F "address=12 Marina Road, Lagos Island" \
  -F "taxId=TIN-12345678" \
  -F "contactPerson=John Doe" \
  -v
```

---

## 2. Full Registration (All Fields + Financial Info)

```bash
curl -X POST "https://your-api-domain.com/api/vendors/register" \
  -H "Accept: application/json" \
  -F "companyName=Acme Supplies Ltd" \
  -F "category=Raw Materials" \
  -F "email=vendor@acmesupplies.com" \
  -F "phone=+2348012345678" \
  -F "address=12 Marina Road, Lagos Island" \
  -F "taxId=TIN-12345678" \
  -F "contactPerson=John Doe" \
  -F "bank_name=First Bank of Nigeria" \
  -F "account_number=0123456789" \
  -F "account_name=Acme Supplies Ltd" \
  -F "currency=NGN" \
  -F "financial_country_code=NG" \
  -v
```

---

## 3. Full Registration + Document Uploads

```bash
curl -X POST "https://your-api-domain.com/api/vendors/register" \
  -H "Accept: application/json" \
  -F "companyName=Acme Supplies Ltd" \
  -F "category=Equipment" \
  -F "email=vendor@acmesupplies.com" \
  -F "phone=+2348012345678" \
  -F "address=12 Marina Road, Lagos Island" \
  -F "taxId=TIN-12345678" \
  -F "contactPerson=John Doe" \
  -F "bank_name=Access Bank" \
  -F "account_number=0987654321" \
  -F "account_name=Acme Supplies Ltd" \
  -F "currency=NGN" \
  -F "financial_country_code=NG" \
  -F "documents[]=@/path/to/cac_certificate.pdf" \
  -F "document_types[]=CAC" \
  -F "document_names[]=CAC Certificate" \
  -F "documents[]=@/path/to/tax_certificate.pdf" \
  -F "document_types[]=TIN" \
  -F "document_names[]=Tax Certificate" \
  -F "documents[]=@/path/to/hse_docs.pdf" \
  -F "document_types[]=HSE_CERTIFICATE" \
  -F "document_names[]=HSE Documents" \
  -v
```

---

## 4. Admin-Authenticated Registration

If an admin is submitting on behalf of a vendor, include the `Authorization` header:

```bash
curl -X POST "https://your-api-domain.com/api/vendors/register" \
  -H "Accept: application/json" \
  -H "Authorization: Bearer YOUR_JWT_TOKEN_HERE" \
  -F "companyName=Delta Engineering Co" \
  -F "category=Construction" \
  -F "email=info@deltaeng.com" \
  -F "phone=+2349098765432" \
  -F "address=Plot 5, Trans Amadi, Port Harcourt" \
  -F "taxId=TIN-87654321" \
  -F "contactPerson=Jane Smith" \
  -v
```

---

## 5. FormData Key Reference

| FormData Key               | Type     | Required | Example Value                   | Notes                                      |
|----------------------------|----------|----------|---------------------------------|--------------------------------------------|
| `companyName`              | string   | **Yes**  | `Acme Supplies Ltd`             | Company legal name                         |
| `category`                 | string   | **Yes**  | `Raw Materials`                 | One of the predefined categories (see below) |
| `email`                    | string   | **Yes**  | `vendor@acme.com`               | Company email                              |
| `phone`                    | string   | No*      | `+2348012345678`                | With country code                          |
| `address`                  | string   | No*      | `12 Marina Road, Lagos`         | Full address                               |
| `taxId`                    | string   | No*      | `TIN-12345678`                  | Tax Identification Number                  |
| `contactPerson`            | string   | No*      | `John Doe`                      | Primary contact name                       |
| `bank_name`                | string   | No       | `First Bank of Nigeria`         | Bank name (dropdown or free text)          |
| `account_number`           | string   | No       | `0123456789`                    | Bank account number                        |
| `account_name`             | string   | No       | `Acme Supplies Ltd`             | Name on bank account                       |
| `currency`                 | string   | No       | `NGN`                           | 3-letter currency code                     |
| `financial_country_code`   | string   | No       | `NG`                            | ISO 3166-1 alpha-2 country code            |
| `documents[]`              | file     | No       | `@/path/to/file.pdf`           | One entry per uploaded file                |
| `document_types[]`         | string   | No       | `CAC`                           | Matches the file at the same index         |
| `document_names[]`         | string   | No       | `CAC Certificate`               | Human-readable name for the document       |

> \* These fields are sent only when non-empty. The frontend treats all fields as mandatory via form validation, but the API call itself only requires `companyName`, `category`, and `email`.

---

## 6. Valid Categories

The frontend allows these category values:

- `Raw Materials`
- `Equipment`
- `Office Supplies`
- `Construction`
- `Safety Equipment`
- `Automobile`
- `Transportation`
- `IT Services`
- `Logistics`
- `Catering`
- `Maintenance`
- `Consulting`
- `Manufacturing`
- `Chemicals`
- `Medical Supplies`

---

## 7. Valid Document Types

| Type                    | Label                      |
|-------------------------|----------------------------|
| `CAC`                   | CAC Certificate            |
| `TIN`                   | Tax Certificate            |
| `HSE_CERTIFICATE`       | HSE Documents              |
| `NUPRC_DPR`             | NUPRC (DPR)                |
| `PENCOM`                | PENCOM                     |
| `ITF`                   | ITF                        |
| `NSITF`                 | NSITF                      |
| `LETTER_OF_INTRODUCTION`| Letter of Introduction     |
| `COMPANY_PROFILE`       | Company Profile            |
| `CAC_FORM_7`            | CAC Form 7                 |
| `CAC_FORM_5`            | CAC Form 5                 |
| `OEM_CERTIFICATE`       | OEM Certificate            |
| `OEM_AUTHORIZATION`     | OEM Authorization Letter   |
| `BANK_REFERENCE`        | Bank Reference Letter      |
| `OTHER`                 | Other                      |

---

## 8. Expected Responses

### Success (200/201)

```json
{
  "registration": {
    "id": 1,
    "companyName": "Acme Supplies Ltd",
    "category": "Raw Materials",
    "email": "vendor@acmesupplies.com",
    "status": "Pending",
    "created_at": "2026-04-08T12:00:00.000000Z"
  }
}
```

### Validation Error (422)

```json
{
  "message": "The given data was invalid.",
  "errors": {
    "email": ["The email field is required."],
    "companyName": ["The company name field is required."]
  }
}
```

### Server Error (500)

```json
{
  "message": "Server Error",
  "exception": "Illuminate\\...",
  "file": "...",
  "line": 123
}
```

---

## 9. Quick Troubleshooting

| Symptom                         | Likely Cause                                  | Fix                                                   |
|---------------------------------|-----------------------------------------------|-------------------------------------------------------|
| HTML response instead of JSON   | Missing `Accept: application/json` header     | Add `-H "Accept: application/json"` to curl           |
| 419 CSRF token mismatch         | CSRF middleware on API route                  | Ensure route is in `api.php` (not `web.php`)          |
| 500 with S3/storage error       | AWS S3 credentials misconfigured              | Check `.env` for `AWS_ACCESS_KEY_ID`, bucket, region  |
| 422 with unknown field errors   | Backend expecting snake_case for some fields  | Check Laravel FormRequest rules match keys above      |
| Registration saved but not shown| GET endpoint reads a different table or status | Verify both POST and GET hit the same table           |
