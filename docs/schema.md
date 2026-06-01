# Schema Integration

FoxHound is schema-aware -- when a schema array is attached to a query, it uses the column type annotations to automatically manage identity columns, timestamps, user stamps, and soft-delete tracking.

## Attaching a Schema

The schema is set on the `query.schema` property, typically by Meadow before query generation:

```javascript
tmpQuery.query.schema = [
    {Column: 'IDBook', Type: 'AutoIdentity'},
    {Column: 'GUIDBook', Type: 'AutoGUID'},
    {Column: 'Title', Type: 'String'},
    {Column: 'Author', Type: 'String'},
    {Column: 'PublishedYear', Type: 'Integer'},
    {Column: 'Metadata', Type: 'JSON'},
    {Column: 'Extras', Type: 'JSONProxy', StorageColumn: 'ExtrasJSON'},
    {Column: 'CreateDate', Type: 'CreateDate'},
    {Column: 'CreatingIDUser', Type: 'CreateIDUser'},
    {Column: 'UpdateDate', Type: 'UpdateDate'},
    {Column: 'UpdatingIDUser', Type: 'UpdateIDUser'},
    {Column: 'Deleted', Type: 'Deleted'},
    {Column: 'DeleteDate', Type: 'DeleteDate'},
    {Column: 'DeletingIDUser', Type: 'DeleteIDUser'}
];
```

## Schema Column Types

| Type | Purpose | Create | Read | Update | Delete | Undelete |
|------|---------|--------|------|--------|--------|----------|
| `AutoIdentity` | Auto-increment primary key | `NULL` (DB assigns) | included | **skipped** | -- | -- |
| `AutoGUID` | Auto-generated UUID | UUID or user value | included | included | -- | -- |
| `CreateDate` | Row creation timestamp | `NOW()` | included | **skipped** | -- | -- |
| `CreateIDUser` | Row creator user ID | `IDUser` | included | **skipped** | -- | -- |
| `UpdateDate` | Last modification timestamp | `NOW()` | included | `NOW()` | `NOW()` | `NOW()` |
| `UpdateIDUser` | Last modifier user ID | `IDUser` | included | `IDUser` | -- | `IDUser` |
| `Deleted` | Soft-delete flag | `0` | auto-filtered | -- | set to `1` | set to `0` |
| `DeleteDate` | Deletion timestamp | **skipped** | included | **skipped** | `NOW()` | -- |
| `DeleteIDUser` | Deleter user ID | **skipped** | included | **skipped** | `IDUser` | -- |
| `String` | Text data | parameterized | included | parameterized | -- | -- |
| `Integer` | Numeric data | parameterized | included | parameterized | -- | -- |
| `Decimal` | Decimal data | parameterized | included | parameterized | -- | -- |
| `Boolean` | Boolean data | parameterized | included | parameterized | -- | -- |
| `DateTime` | Date/time data | parameterized | included | parameterized | -- | -- |
| `JSON` | Structured JSON data | `JSON.stringify` | included | `JSON.stringify` | -- | -- |
| `JSONProxy` | JSON with different SQL column name | `JSON.stringify` to `StorageColumn` | included | `JSON.stringify` to `StorageColumn` | -- | -- |

## JSON and JSON Proxy Types

FoxHound supports two schema types for structured JSON data stored as `TEXT` in SQL databases.

### JSON

The `JSON` type marks a column whose value should be serialized with `JSON.stringify` on write and deserialized with `JSON.parse` on read. The SQL column name matches the object property name.

```javascript
{ Column: 'Metadata', Type: 'JSON' }
```

On CREATE and UPDATE, FoxHound automatically calls `JSON.stringify` on the value. If the value is already a string, it is passed through as-is.

### JSON Proxy

The `JSONProxy` type stores JSON in a SQL column with a different name than the JavaScript property. The `StorageColumn` property specifies the actual SQL column name.

```javascript
{ Column: 'Preferences', Type: 'JSONProxy', StorageColumn: 'PreferencesJSON' }
```

On CREATE and UPDATE, FoxHound:
- Uses `StorageColumn` (`PreferencesJSON`) as the column name in the SQL statement
- Calls `JSON.stringify` on the value from the `Column` property (`Preferences`)

On READ, the Meadow provider layer handles deserialization: the raw `PreferencesJSON` text column is parsed and mapped to the `Preferences` property, and the storage column is hidden from the result object.

### JSON Path Filtering

You can filter on nested JSON properties using dot notation in `addFilter`:

```javascript
tmpQuery
    .addFilter('Metadata.habitat', 'forest')
    .addFilter('Metadata.weight', 100, '>');
```

FoxHound generates dialect-specific JSON path expressions:

| Dialect | Generated SQL |
|---------|---------------|
| MySQL | `JSON_EXTRACT(Metadata, '$.habitat') = :Metadata_habitat_w0` |
| PostgreSQL | `Metadata->>'habitat' = :Metadata_habitat_w0` |
| SQLite | `json_extract(Metadata, '$.habitat') = :Metadata_habitat_w0` |
| MSSQL | `JSON_VALUE(Metadata, '$.habitat') = :Metadata_habitat_w0` |

Nested paths are supported (e.g., `Metadata.dimensions.width`). JSON Proxy columns are automatically resolved to their storage column in the SQL expression.

## How Schema Affects Each Operation

### Create (INSERT)

- `AutoIdentity` -> inserts `NULL` (MySQL/SQLite) or is omitted (MSSQL)
- `AutoGUID` -> generates a UUID via Fable, unless the record has a valid GUID already
- `CreateDate`, `UpdateDate` -> inserts the current timestamp
- `CreateIDUser`, `UpdateIDUser` -> inserts the user ID from `setIDUser()`
- `DeleteDate`, `DeleteIDUser` -> **skipped** (when delete tracking is enabled)

### Update

- `AutoIdentity`, `CreateDate`, `CreateIDUser`, `DeleteDate`, `DeleteIDUser` -> **skipped**
- `UpdateDate` -> set to current timestamp automatically
- `UpdateIDUser` -> set to the value from `setIDUser()`
- All other columns -> parameterized from the record

### Delete (Soft)

Only these columns are modified:
- `Deleted` -> set to `1`
- `DeleteDate` -> set to current timestamp
- `UpdateDate` -> set to current timestamp
- `DeleteIDUser` -> set to the value from `setIDUser()`

### Undelete

Only these columns are modified:
- `Deleted` -> set to `0`
- `UpdateDate` -> set to current timestamp
- `UpdateIDUser` -> set to the value from `setIDUser()`

### Read / Count

- Automatically adds `WHERE Deleted = 0` filter when a `Deleted` column type is in the schema
- Uses the `AutoIdentity` column for `DISTINCT COUNT` operations when no specific fields are set

## Disabling Auto-Management

| Flag | Effect |
|------|--------|
| `setDisableAutoIdentity(true)` | Include identity values as-is (don't insert NULL) |
| `setDisableAutoDateStamp(true)` | Don't auto-generate timestamps |
| `setDisableAutoUserStamp(true)` | Don't auto-stamp user IDs |
| `setDisableDeleteTracking(true)` | Include delete columns on insert; skip soft-delete filter on reads |

## Stricture Integration

Schemas are typically defined using [Stricture](https://fable-retold.github.io/stricture/), a companion tool that generates schema definitions from a DDL-like JSON format.  Stricture produces the exact schema array format that FoxHound expects.
