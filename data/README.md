# Resident records

`units.json` is what the resident portal reads. Replace the three sample records with
real ones and the portal works against your homes — no code change needed.

## Shape

```json
{
  "CG-1428": {
    "address": "1428 Cypress Grove Ln",
    "community": "Cypress Grove",
    "city": "Katy, TX 77494",
    "plan": "The Sabine",
    "closed": "2024-03-15",
    "history": [
      { "date": "2025-02-18", "type": "11-month warranty walk",
        "note": "Nine items logged, all closed within two weeks.", "state": "closed" }
    ]
  }
}
```

| Field | Notes |
| --- | --- |
| key | The unit code residents can type. Anything unique; shown in the lookup hint. |
| `closed` | `YYYY-MM-DD`. Drives every warranty countdown — 1 / 2 / 10 years from this date. |
| `history` | Newest first is not required; the portal sorts. |
| `state` | `open` or `closed`. Open items feed the "open requests" count. |

Residents are found by unit code, by full street address, or by street number alone,
all case-insensitive.

## Before this holds real resident data

This file is served as a **public static asset** — anyone who can reach the site can
download every record in it. That is fine for sample data and not fine for real
homeowners: addresses and service history are personal information.

Putting real records here means putting them on the open internet. Serve them from an
authenticated endpoint behind a resident login instead, and keep this file for the
demo. The lookup reads from a single `fetch`, so swapping the source is a one-line
change in `status.html`.
