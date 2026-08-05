# Pagination

FoxHound provides dialect-aware pagination through the `setBegin()` and `setCap()` methods.

## Basic Usage

```javascript
// Get the first 20 records
tmpQuery
    .setScope('Books')
    .setCap(20)
    .setDialect('MySQL')
    .buildReadQuery();

// MySQL:  SELECT ... LIMIT 20;
// MSSQL:  SELECT ... OFFSET 0 ROWS FETCH NEXT 20 ROWS ONLY;
// SQLite: SELECT ... LIMIT 20;
```

## Offset Pagination

```javascript
// Skip the first 40 records, then get 20
tmpQuery
    .setScope('Books')
    .setBegin(40)
    .setCap(20)
    .setDialect('MySQL')
    .buildReadQuery();

// MySQL:  SELECT ... LIMIT 40, 20;
// MSSQL:  SELECT ... OFFSET 40 ROWS FETCH NEXT 20 ROWS ONLY;
// SQLite: SELECT ... LIMIT 20 OFFSET 40;
```

## Methods

### setCap(pCapAmount)

Set the maximum number of records to return.  Must be a non-negative integer.

```javascript
tmpQuery.setCap(50);   // Return at most 50 rows
tmpQuery.setCap(false); // Remove the cap (return all rows)
```

### setBegin(pBeginAmount)

Set the zero-based starting offset.  Must be a non-negative integer.

```javascript
tmpQuery.setBegin(100);  // Start at the 101st record
tmpQuery.setBegin(false); // Remove the offset
```

## Page-Based Pagination Helper

FoxHound doesn't include a built-in page number helper, but it's easy to calculate:

```javascript
var tmpPageSize = 20;
var tmpPageNumber = 3; // Zero-based

tmpQuery
    .setBegin(tmpPageNumber * tmpPageSize)
    .setCap(tmpPageSize);
```

## Dialect Syntax Comparison

| Dialect | Cap Only | Cap + Begin |
|---------|----------|-------------|
| **MySQL** | `LIMIT 20` | `LIMIT 40, 20` |
| **MSSQL** | `OFFSET 0 ROWS FETCH NEXT 20 ROWS ONLY` | `OFFSET 40 ROWS FETCH NEXT 20 ROWS ONLY` |
| **SQLite** | `LIMIT 20` | `LIMIT 20 OFFSET 40` |
| **ALASQL** | `LIMIT 20` | `LIMIT 20 FETCH 40` |

> **Note:** MSSQL's `OFFSET ... FETCH` syntax requires an `ORDER BY` clause.  Stable pagination supplies one automatically; where no identity column can be resolved the dialect falls back to `ORDER BY (SELECT 1)`.

## Stable Pagination

Paging a query whose sort is not a *total order* has no defined behavior in any SQL engine.  Consecutive pages may overlap, and rows falling between them are never returned.  The total row count still looks right, so the loss is silent — only a caller collecting distinct identifiers notices.

PostgreSQL surfaces this most readily: `synchronize_seqscans` (on by default) lets each page's sequential scan start wherever the previous scan on that relation left off, for any relation larger than `shared_buffers / 4`.  `OFFSET` then counts forward from that arbitrary point.  Measured on a 147k-row table with a 32MB `shared_buffers`, a full paged sweep recovered only 63% of the rows.

FoxHound closes this by making the order total whenever a read is capped.  The identity column is appended to the sort as a final tiebreaker:

```javascript
// No sort supplied
tmpQuery.setScope('Book').setCap(500).setBegin(1000);
// SELECT "Book".* FROM "Book" ORDER BY "IDBook" LIMIT 500 OFFSET 1000;

// Caller sort on a non-unique column — still not a total order on its own
tmpQuery.setScope('Book').setCap(500).setSort([{Column:'Title',Direction:'Descending'}]);
// SELECT "Book".* FROM "Book" ORDER BY "Title" DESC, "IDBook" LIMIT 500;
```

A caller-supplied sort always leads; the identity column only breaks ties, and is omitted when the caller already sorted on it.

The identity column is resolved from the query's schema — an `AutoIdentity` entry first, then `query.defaultIdentifier` (meadow's `DefaultIdentifier`, which covers primary keys that aren't auto-increment) provided the schema confirms the column exists.  When neither resolves, no sort is added.

Nothing is appended when:

- the query has no cap — an unpaged read returns every row regardless of order
- `distinct` is set — SQL rejects an `ORDER BY` term that isn't in the `SELECT DISTINCT` list
- a query override is in play — the override owns its own clause placement, and may be grouping
- `parameters.disableStableSort` is set — the explicit opt-out, for a deliberately cheap unordered scan

```javascript
tmpQuery.parameters.disableStableSort = true;
```

All six SQL dialects behave identically here, including the MSSQL and Oracle `legacyPagination` wrappers — the same total order is what `ROW_NUMBER() OVER` and the `ROWNUM` subquery order by.

> **Note:** ordering by the primary key generally moves PostgreSQL to an index scan, which is what defeats syncscan.  A deep `OFFSET` still walks every preceding index entry, so this makes a full sweep *correct*, not fast.  For large sweeps prefer keyset pagination — filter on `IDTable > :last` and cap — which stays O(page).

## No Cap, No Pagination

If `setCap()` is not called (or is set to `false`), no pagination clause is generated and all matching rows are returned.
