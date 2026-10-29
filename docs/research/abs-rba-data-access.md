# ABS and RBA Data Access

This note checks from first principles which access route `ausecon` should
build on for Australian Bureau of Statistics (ABS) and Reserve Bank of
Australia (RBA) data. It covers every route each source offers, compares them
for a library that runs on any runtime, and asks what data layer a TUI-first
tool needs: search, one series model, freshness checks, and low latency. It
ends with a recommendation per source and the changes it implies for v0.3.0.
All probes ran on 2026-10-29 with `curl`, Python, and the vendored SheetJS
0.20.3, against the live endpoints cited.

---

## Contents

- [Summary](#summary)
- [Method](#method)
- [ABS Access Routes](#abs-access-routes)
- [ABS Data API in Detail](#abs-data-api-in-detail)
- [ABS Time Series Directory and Spreadsheets](#abs-time-series-directory-and-spreadsheets)
- [RBA Access Routes](#rba-access-routes)
- [RBA CSV Against Spreadsheet](#rba-csv-against-spreadsheet)
- [Discovery and Search](#discovery-and-search)
- [One Series Model](#one-series-model)
- [Freshness Signals](#freshness-signals)
- [Interactive Latency](#interactive-latency)
- [Coverage Parity](#coverage-parity)
- [Route Comparison](#route-comparison)
- [Recommendation](#recommendation)
- [Changes to the Release Plan](#changes-to-the-release-plan)
- [References](#references)

## Summary

- **ABS: keep the Time Series Directory and time series spreadsheets.** They
  are the only route that addresses series IDs, table numbers, and the full
  set of time series. The Data API holds about half the series of Labour Force
  (`6202.0`) in a different key scheme, carries no ABS series ID, and calls
  itself a beta with every dataflow but one flagged non-production.
- **RBA: read the spreadsheets, not the CSV files.** The CSV files round
  values to the displayed precision (D2 `3843.222` becomes `3843.2`), use two
  text encodings, and drop sheets that the spreadsheet holds. The RBA offers
  no API or SDMX service.
- **Discovery needs a generated index for both sources.** Neither source can
  list its series in one cheap request. The Time Series Directory rejects
  `catno=*`, and a prefix sweep is 1,187 pages. A TUI series picker therefore
  needs a Series Index built ahead of time that holds ABS and RBA series.
- **One series model works.** ABS series IDs all match `A\d+[A-Z]`. None of
  the 4,125 RBA series IDs in the current CSV files matches it. A source
  prefix such as `abs:` or `rba:` still makes the scheme explicit.
- **Freshness is cheap per file.** ABS and RBA files answer
  `If-Modified-Since` with 304. The Data API has no validators, and its
  `updatedAfter` parameter returned no data.

## Method

ABS documentation came from the ABS API pages [abs-apis] [abs-api-guide]
[abs-indicator-api] [abs-tsd-api]. Data API behaviour came from live requests
to `data.api.abs.gov.au` for the dataflow list [abs-dataflows], the Labour
Force structure [abs-dsd-lf], and Labour Force, Wage Price Index (WPI), and
Consumer Price Index (CPI) data. Time Series Directory behaviour came from
live queries [abs-tsd-sid] and full page sweeps of `6202.0` and `6345.0`.

RBA routes came from the statistics pages [rba-statistics], the tables page
[rba-tables], the RSS page [rba-rss], the release schedule [rba-schedule],
the changes log [rba-changes], and `sitemap.xml` [rba-sitemap]. All 221
current CSV files and six spreadsheets were downloaded. Spreadsheet cells were
read with SheetJS and compared cell by cell with the CSV values in Python.

CORS was checked with an `Origin: https://example.com` header on a GET and on
an `OPTIONS` preflight. Timings are single runs from Melbourne and vary with
CDN cache state.

## ABS Access Routes

| Route                    | Endpoint                             | Auth                     | Format                       | CORS                        | Series IDs        | Status                                                             |
| ------------------------ | ------------------------------------ | ------------------------ | ---------------------------- | --------------------------- | ----------------- | ------------------------------------------------------------------ |
| Time Series Directory    | `abs.gov.au/servlet/TSSearchServlet` | None, but a User-Agent   | XML, 100 series per page     | No                          | Yes, `sid=` query | Documented, page released 16/12/2025, no deprecation [abs-tsd-api] |
| Time series spreadsheets | Table URLs under each release        | None, but a User-Agent   | `.xlsx`                      | No                          | Yes, row 10       | No retirement announced                                            |
| Data Cubes               | Links on release pages               | None, but a User-Agent   | `.xlsx`, `.zip`              | No                          | No                | Found only by scraping release pages                               |
| Data API                 | `data.api.abs.gov.au/rest/`          | None since 29/11/2024    | SDMX-ML, SDMX-JSON, SDMX-CSV | Yes                         | No                | Beta, "availability ... is not guaranteed" [abs-api-guide]         |
| Indicator API            | `indicator.api.abs.gov.au`           | API key by email request | JSON, CSV, XML               | Not tested, 403 without key | Not tested        | Live, 20 headline datasets [abs-indicator-api]                     |
| Data Explorer            | `dataexplorer.abs.gov.au`            | None                     | Web UI over the Data API     | Not applicable              | No                | User interface for the Data API [abs-apis]                         |

Sources: [abs-apis] [abs-api-guide] [abs-indicator-api] [abs-tsd-api]
[abs-lfd-release], and the probes below.

- The ABS lists three APIs: the Data API, the Indicator API, and the Time
  Series Directory API [abs-apis]. None of the pages announces a retirement.
- The Indicator API is "Live and ready for production use", needs a key
  requested by form and email, and covers 20 headline datasets
  [abs-indicator-api]. A request without a key returned 403
  `Missing Authentication Token` [abs-indicator-probe]. A key per user rules it
  out for a public library.
- Bulk downloads exist only per release. Labour Force returned the "full
  suite" with the September 2026 reference period, "including monthly and
  quarterly time series spreadsheet zip downloads" [abs-lfs-changes].
- No ABS page found announces the end of time series spreadsheets or the Time
  Series Directory. Product-level changes do happen. Labour Force retired eight
  tables and paused others from April 2026 [abs-lfs-changes].
- Data Cubes such as `EM1a.xlsx` sit beside the time series spreadsheets on
  the Labour Force, Australia, Detailed release page [abs-lfd-release]. They
  are reachable only through page links, which `readabs` scrapes with CSS
  selectors ([cowgill-doc], section "Data Cubes and Convenience Functions").

## ABS Data API in Detail

This section covers what the Data API holds, how it names series, and how it
behaves.

### Coverage

`GET rest/dataflow/ABS` returned 1,228 dataflows (2.65 MB of SDMX-JSON,
137 KB gzip) [abs-dataflows]. Each description ends with a catalogue number
where one exists. 590 dataflows name one, across 60 catalogue numbers.

| Catalogue Number | Product                 | Dataflows                                                                           |
| ---------------- | ----------------------- | ----------------------------------------------------------------------------------- |
| `6202.0`         | Labour Force            | `LF`, `LF_AGES`, `LF_EDU`, `LF_HOURS`, `LF_STAT_EMP`, `LF_UNDER`, `LF_WEEKLY_HOURS` |
| `6401.0`         | CPI                     | `CPI` (2.0.0), `CPI_Q`. `CPI_M` is marked `CEASED`                                  |
| `6345.0`         | Wage Price Index        | `WPI`                                                                               |
| `5206.0`         | National Accounts       | `ANA_EXP`, `ANA_INC`, `ANA_IND_GVA`, `ANA_SFD`. `ANA_AGG` names no number           |
| `8501.0`         | Retail Trade            | `RT`                                                                                |
| `5302.0`         | Balance of Payments     | `BOP`, `BOP_FACTOR`, `BOP_GOODS`, `BOP_STATE`, `IIP`                                |
| `6302.0`         | Average Weekly Earnings | `AWE`                                                                               |
| `6291.0.55.001`  | Labour Force, Detailed  | None                                                                                |

Source: [abs-dataflows].

The dataflows hold fewer series than the spreadsheets:

| Product               | Data API series                                          | Time Series Directory series IDs | Time Series Directory tables |
| --------------------- | -------------------------------------------------------- | -------------------------------- | ---------------------------- |
| Labour Force `6202.0` | 4,272 across the seven `LF*` dataflows (`LF` alone: 744) | 9,486                            | 40                           |
| WPI `6345.0`          | 396                                                      | 648                              | 17                           |

Sources: one `lastNObservations=1` query per dataflow, counted by row
[abs-data-lf]; all 113 and 10 Directory pages, counted by unique `SeriesID`
and `TableURL` [abs-tsd-catno].

No dataflow matched Payroll Jobs, job mobility, or Labour Force gross flows
(name search over [abs-dataflows]). The Data API does carry Census, regional
population, and building approval flows that have no time series
spreadsheet.

### Series Identity

The Data API keys a series by dimension codes. The seasonally adjusted
unemployment rate for persons is `LF/M13.3.1599.20.AUS.M`
(`MEASURE.SEX.AGE.TSEST.REGION.FREQ`) [abs-dsd-lf]. The Directory calls the
same series `A84423050A` [abs-tsd-sid]. Neither the structures of `LF`,
`WPI`, `CPI`, and `ANA_AGG`, nor their attributes (`UNIT_MEASURE`,
`UNIT_MULT`, `OBS_STATUS`, `OBS_COMMENT`, `DECIMALS`, `BASE_PERIOD`), nor
their annotations contain an ABS series ID. A text search of the Labour Force
structure for `A84423050A` and `SERIES_ID` found nothing. A `readabs` user who
holds series IDs cannot use the Data API without a hand-built mapping.

The Data API has no table numbers. Its keys also do not line up one to one
with spreadsheet series, as the counts above show.

### Values and Timing

| Check                                    | Data API     | Spreadsheet                         |
| ---------------------------------------- | ------------ | ----------------------------------- |
| Latest Labour Force period on 2026-10-29 | `2026-09`    | Sep 2026, released 15/10/2026       |
| Latest CPI period on 2026-10-29          | `2026-09`    | September 2026, released 28/10/2026 |
| A84423050A, September 2026               | `4.71834873` | `4.7183487`                         |

Sources: [abs-data-lf] [abs-tsd-sid] [abs-tsd-cpi] [abs-lf-table1].

Both routes had the latest release one day after the CPI release. The guide
still warns that beta data "may not necessarily be the most up to date"
[abs-api-guide]. The Data API returns one more digit. SDMX-CSV rows were not
in period order: `2026-09` came last.

### Stability and Limits

- The guide calls the service a beta that "may be subject to change". Its
  29 November 2024 update moved the base path and removed API keys
  [abs-api-guide].
- 1,227 of 1,228 dataflows carry the annotation
  `NonProductionDataflow: true` [abs-dataflows]. Every SDMX-JSON data message
  probed had `"test": true` in its `meta` block, from sender
  `Stable_-_DotStat_v8`.
- Dataflow versions change with the product. Monthly CPI moved to `CPI`
  version 2.0.0 and `CPI_M` is `CEASED` [abs-dataflows]. A client must
  request the latest version, not pin one.
- No rate limit is documented. The guide says only that "performance and
  availability may be impacted during periods of high use"
  [abs-api-guide]. No rate limit headers came back.
- A request with an empty User-Agent returned 403, like the rest of the ABS.
  Browsers always send one.
- The `format` parameter works as well as the `Accept` header:
  `format=jsondata` returned SDMX-JSON 2.0 and `format=csvfilewithlabels`
  returned SDMX-CSV 2.
- `updatedAfter=2026-10-10T00:00:00` and `updatedAfter=2025-01-01T00:00:00`
  both returned 200 with an empty body for a series that changed on
  15/10/2026. `updatedAfter=2026-10-20T00:00:00` returned 404
  `NoRecordsFound`. The parameter cannot drive a freshness check.

### CORS

A GET with an `Origin` header returned
`access-control-allow-origin: https://example.com`. A preflight returned 200
with `access-control-allow-methods: GET` and allowed headers `Range`,
`Origin`, `Authorization`, `X-Level`, `X-Range`, and `X-Release`. `Accept` is
a CORS-safelisted header, so a browser GET with an SDMX `Accept` header works.
The Data API is the only ABS route that a browser can call without a proxy.

## ABS Time Series Directory and Spreadsheets

The earlier survey covers the Directory and spreadsheet layout
([cowgill-doc], sections "Time Series Directory Mechanics" and "Workbook
Layout and Tidying"). New findings:

- `catno=*` and `ptitle=*` return `<Error>Invalid query.</Error>`. A trailing
  wildcard after a digit works: `catno=6*` returned 489 pages. The nine
  prefixes `1*` to `9*` total 1,187 pages, about 118,700 series rows
  [abs-tsd-catno]. A full crawl at about 100 KB per page is about 120 MB of
  XML.
- A `sid=` lookup returns about 3.9 KB in 60 to 120 ms. It names every table
  that holds the series, with `Description`, `Unit`, `SeriesType`,
  `Frequency`, `SeriesStart`, `SeriesEnd`, `NoObs`, and `ProductReleaseDate`
  [abs-tsd-sid].
- Directory responses carry `cache-control: no-cache, no-store,
  must-revalidate` and no validators.
- The `latest-release` Table URL returns 302 to a dated URL such as
  `.../sep-2026/62020001.xlsx`. The dated file sends `Last-Modified` and no
  `ETag`. `If-Modified-Since` returned 304. A `Range: bytes=0-4095` request
  returned 206, but an `.xlsx` file keeps its ZIP index at the end, so a
  partial read does not help.
- Labour Force Table 1 (`62020001.xlsx`) is 773 KB and downloaded in 0.26 s
  [abs-lf-table1].

## RBA Access Routes

| Route                      | Endpoint                                    | Format                      | CORS | Series IDs  | Notes                                                 |
| -------------------------- | ------------------------------------------- | --------------------------- | ---- | ----------- | ----------------------------------------------------- |
| Current Table spreadsheets | `/statistics/tables/xls/*.xlsx`, `.xls`     | 87 `.xlsx`, 7 `.xls`        | No   | Yes         | Includes `Notes` and `Series breaks` sheets           |
| Current Table CSV files    | `/statistics/tables/csv/*.csv`              | 221 CSV                     | No   | Yes, in 168 | Rounded values, see below                             |
| Historical Tables          | `/statistics/historical-data.html`          | 37 `.xls`, 1 `.xlsx`, 2 CSV | No   | Yes         | Mostly BIFF `.xls`                                    |
| RSS-CB feeds               | `/rss/rss-cb-*.xml`                         | RSS 1.0 with RSS-CB         | No   | No          | Exchange rates hold only the latest rate per currency |
| Release schedule           | `/schedules-events/schedule.html`           | HTML                        | No   | No          | No calendar feed                                      |
| SMP forecasts              | `/statistics/xls/smp-forecast-archive.xlsx` | `.xlsx`, 94 KB              | No   | No          | Plus the HTML forecasts archive                       |
| Cash rate page             | `/statistics/cash-rate/`                    | HTML, 145 KB                | No   | No          | The same series are in tables A2 and F1               |

Sources: [rba-tables] [rba-historical] [rba-rss] [rba-rss-fx]
[rba-schedule] [rba-smp-forecasts] [rba-cash-rate].

The seven current `.xls` files are `d09hist.xls`, `e03hist.xls` to
`e07hist.xls`, and `xls-hist/2023-current.xls`, the daily exchange rates
table F11.1 (counted from `href` values on [rba-tables]).

No RBA API, SDMX service, or JSON feed was found:

- The statistics and tables pages link no API [rba-statistics] [rba-tables].
- `sitemap.xml` holds 10,960 URLs. None contains `api` or `sdmx`
  [rba-sitemap].
- The RSS page lists ten feeds. Two concern statistics. "Changes to
  Statistical Tables" announces layout changes [rba-rss-changes]. "Exchange
  Rates" gives the 4 pm rate for 21 currencies and the TWI, one item each
  [rba-rss-fx].
- The changes log records CSV publication from the 2 June 2014 redesign and a
  2018 change to full dates in the CSV files. It mentions no API
  [rba-changes].

The release schedule says RBA data appears "at 11.30 am", and "data produced
by other organisations will generally be updated on this website at 11.30 am
one day after their release" [rba-schedule]. G1 (CPI) is sourced
`ABS / RBA` [rba-g1-csv], so for ABS series the ABS route is a day fresher.

All RBA files are `application/octet-stream`, send `Last-Modified` and
`cache-control: max-age=30`, answer `If-Modified-Since` with 304, and honour
`Range` (206 for `bytes=0-4095` on `f1-data.csv`). No RBA file sent an
`Access-Control-Allow-Origin` header.

## RBA CSV Against Spreadsheet

The RBA does not say which format is meant for machine use. The tables page
links the spreadsheet from the title and the CSV files as "Data"
[rba-tables]. Both carry the same metadata labels and the same series IDs,
but they are not the same data.

| Table | Spreadsheet                                                    | CSV                                             | Series IDs equal | Values that differ | Largest difference |
| ----- | -------------------------------------------------------------- | ----------------------------------------------- | ---------------- | ------------------ | ------------------ |
| F1.1  | `f01hist.xlsx`, sheets `Data`, `Notes`                         | `f1.1-data.csv`                                 | Yes, 15          | 814 of 4,308       | 0.5                |
| G1    | `g01hist.xlsx`, sheets `Data`, `Notes`                         | `g1-data.csv`                                   | Yes              | 0 of 4,470         | 0                  |
| D2    | `d02hist.xlsx`, sheets `Data`, `Notes`, `Series breaks`        | `d2-data.csv`, `d2-series-breaks.csv`           | Yes, 32          | 11,734 of 11,853   | 0.05               |
| C1.1  | `c01-1-hist.xlsx`, sheet `Aggregate`                           | `c1.1-aggregate.csv`                            | Yes, 33          | 9,313 of 9,511     | 0.05               |
| F1    | `f01d.xlsx`, sheets `Data`, `Notes`, `Use of Expert Judgement` | `f1-data.csv`, `f1-use-of-expert-judgement.csv` | Yes              | Rounded, as F1.1   | Not computed       |

Sources: [rba-f11-xlsx] [rba-f11-csv] [rba-g1-xlsx] [rba-g1-csv]
[rba-d2-xlsx] [rba-d2-csv] [rba-tables].

- **The CSV files round values to the displayed precision.** D2 July 2026
  reads `3843.222` in the spreadsheet and `3843.2` in the CSV. F1 daily
  reads `4.825` and `4.83`. F1.1 `FIRMMCRIVM` for June 2014 reads `121398.5`
  and `121399`. Only G1, which is published at its displayed precision,
  matched. `readrba` reads the spreadsheets, so its users see the full
  values.
- **Encoding differs.** 199 of 221 CSV files are UTF-8 with a byte order mark.
  22 are Windows-1252, including `a3-daily-open-market-operations.csv`,
  `a6-data-prior-to-1984.csv`, and all of E3 to E7. The en dash in their
  titles is byte `0x96`.
- **Sheets can be missing.** `e03hist.xls` has sheets `2018`, `2014`,
  `2010`, `2006`, `2002`, and `Notes`. The CSV files cover 2002 to 2014 only.
- **Not every CSV file is data.** 53 of 221 have no `Series ID` row. They
  hold series breaks or notes as prose.
- **Metadata types differ.** `Publication date` is an Excel serial (`46295`)
  in the spreadsheet and text (`30-Sep-2026`) in the CSV. Some CSV files have
  no `Publication date` row.
- **Dates take two forms.** 117 data CSV files use `dd/mm/yyyy`, the rest
  `dd-Mon-yyyy`. Text values such as `N/A` appear in both formats (904 cells
  in F1).
- **Files carry padding.** `g1-data.csv` has 9,998 rows, of which 9,569 are
  blank. Rows are ragged.
- **The CSV files avoid BIFF.** Current tables E3 to E7 and D9 are `.xls`
  only, and each has CSV files. F11.1 daily exchange rates has no CSV.

The CSV set is 13.1 MB across 221 files. The spreadsheet set is 58.4 MB
across 93 unique files. The largest is `f16-1-semis.xlsx` at 13.0 MB
(`Content-Length` from `HEAD` on every link on [rba-tables]).

This corrects the "RBA via CSV" option in the earlier survey
([cowgill-doc], section "Alternative or v0.2: RBA via CSV"), which assumed the
CSV files match the spreadsheets.

## Discovery and Search

A TUI needs fast search over titles, series IDs, units, and frequencies.

| Route                 | Search it offers                                                                                                           | Cost to list everything                                                                                                              |
| --------------------- | -------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------ |
| Time Series Directory | Exact `sid`, `catno`, and prefix wildcards on `ttitle`, `ptitle`, and `catno`. No search over series descriptions or units | About 1,187 pages, about 120 MB of XML                                                                                               |
| Data API structures   | None server side. Dataflow names and codelist labels must be searched locally                                              | 1 request for 1,228 dataflows (137 KB gzip), then 1 structure per dataflow (39 KB for `LF`, 1.37 MB for `WPI` with `references=all`) |
| Data API availability | `availableconstraint` gives the codes that hold data (200, 1.2 KB for `LF`)                                                | 1 request per dataflow                                                                                                               |
| RBA tables page       | A client-side quick search over table titles. Static HTML                                                                  | 1 page, 95 KB, 97 tables                                                                                                             |
| RBA files             | None. Metadata sits in the first 11 rows of each file                                                                      | 221 CSV files (13.1 MB) or 93 spreadsheets (58.4 MB). A 4 KB `Range` request reads one CSV header                                    |

Sources: [abs-tsd-api] [abs-tsd-catno] [abs-dataflows] [abs-dsd-lf]
[rba-tables].

Neither source gives fuzzy search over series metadata. Neither can be listed
cheaply at runtime: the ABS one needs about 1,200 requests, and the RBA one
needs a request per file. A picker that opens without waiting needs a Series
Index built ahead of time, with one row per series: source, series ID,
description, unit, series type, frequency, table, Release, and first and last
period. The Directory supplies all of those fields for ABS rows. RBA rows come
from the `Title`, `Description`, `Frequency`, `Type`, `Units`, and
`Series ID` rows of each Statistical Table.

## One Series Model

| Field       | ABS spreadsheet row            | RBA spreadsheet row                                          | Data API                    |
| ----------- | ------------------------------ | ------------------------------------------------------------ | --------------------------- |
| Series ID   | `Series ID`                    | `Series ID` (`Mnemonic` in some older tables, per `readrba`) | None                        |
| Description | Row 1                          | `Title`, `Description`                                       | Codelist labels of the key  |
| Unit        | `Unit`                         | `Units`                                                      | `UNIT_MEASURE`, `UNIT_MULT` |
| Series type | `Series Type`                  | `Type`                                                       | `TSEST` dimension           |
| Frequency   | `Frequency`                    | `Frequency`                                                  | `FREQ` dimension            |
| Source      | Implied                        | `Source`                                                     | Implied                     |
| Release     | Directory `ProductReleaseDate` | `Publication date`                                           | None in the message         |

Sources: [abs-lf-table1] [rba-g1-csv] [abs-dsd-lf] [cowgill-doc].

The spreadsheet routes share the fields a TUI shows. The Data API needs its
key decoded through codelists before it has a description. ABS series IDs all
match `A\d+[A-Z]` (checked over 10,134 IDs from `6202.0` and `6345.0`). The
4,125 RBA series IDs in the current CSV files are letters and digits, such as
`GCPIAG` and `ACTAPR22D`, and none matches that pattern. A source prefix
(`abs:A84423050A`, `rba:GCPIAG`) is unambiguous and leaves room for a third
source. ABS and RBA values need different text rules: the RBA has `N/A`,
fractions, and ranges ([cowgill-doc], section "Sheet Parsing").

## Freshness Signals

| Route                 | Cheap signal                               | Probe result                                                  |
| --------------------- | ------------------------------------------ | ------------------------------------------------------------- |
| ABS spreadsheet       | `If-Modified-Since` on the dated Table URL | 304                                                           |
| ABS spreadsheet       | `Location` of the `latest-release` 302     | Changes with each Release, no body needed                     |
| Time Series Directory | `ProductReleaseDate` in a `sid` lookup     | 3.9 KB, `no-store`                                            |
| Data API              | `updatedAfter`                             | 200 with empty body, or 404, for a changed series. Unreliable |
| Data API              | Dataflow version                           | Changes with redesigns, not Releases                          |
| RBA file              | `If-Modified-Since`                        | 304                                                           |
| RBA tables page       | None                                       | `max-age=30`, no `Last-Modified`                              |
| RBA RSS               | "Changes to Statistical Tables"            | Layout changes only, last item 2026-08-05                     |
| ABS release calendar  | HTML pages                                 | No feed or ICS link found [abs-release-calendar]              |
| RBA release schedule  | HTML page                                  | No feed or ICS link found [rba-schedule]                      |

Sources: the probes above, [rba-rss-changes], [abs-release-calendar],
[rba-schedule].

A "what's new" view can ask each cached file with `If-Modified-Since`. One
request per file is cheap when it returns 304. For ABS, one `sid` lookup per
followed series or one 302 per table also works.

## Interactive Latency

| Task                 | ABS spreadsheet route                                                                 | ABS Data API                                                | RBA CSV                                                                         | RBA spreadsheet                                                      |
| -------------------- | ------------------------------------------------------------------------------------- | ----------------------------------------------------------- | ------------------------------------------------------------------------------- | -------------------------------------------------------------------- |
| Open a series picker | 0 requests with an index. Without one, 113 Directory pages for `6202.0` (about 10 MB) | 1 dataflow list (137 KB gzip) plus a structure per dataflow | 0 with an index. Without one, the tables page plus a 4 KB `Range` read per file | 0 with an index. Without one, the tables page plus every spreadsheet |
| Preview one series   | 1 `sid` lookup (3.9 KB) plus the whole table (773 KB for Table 1)                     | 1 request: 37 KB for the full history, 1.8 KB from 2026     | 1 file: 40 KB (G1) to 309 KB (F1)                                               | 1 file: 584 KB (G1)                                                  |
| Fetch a full table   | 1 request per table                                                                   | Whole `LF` dataflow: 4.65 MB gzip, 28 MB SDMX-CSV, 7.2 s    | 1 to 13 files                                                                   | 1 file, up to 13.0 MB                                                |

Sources: the timings and sizes above.

The Data API is the fastest way to preview one ABS series, but only once the
series is known by its SDMX key. A first, uncached Data API request took 1.8
to 7.2 s, while cached requests took about 0.13 s.

## Coverage Parity

Each row lists `readabs` and `readrba` exports [readabs-ns] [readrba-ns],
with their mechanism from the earlier survey [cowgill-doc].

| Capability                         | Exports                                                                                                                                               | Best route                                                  | Notes                                                           |
| ---------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------- | --------------------------------------------------------------- |
| ABS by catalogue number and table  | `read_abs()`, `read_abs_url()`, `extract_abs_sheets()`, `tidy_abs()`, `tidy_abs_list()`                                                               | Directory and spreadsheets                                  | Data API has no table numbers                                   |
| ABS by series ID                   | `read_abs_series()`, `read_abs(series_id=)`                                                                                                           | Directory and spreadsheets                                  | Data API has no series IDs                                      |
| ABS local files                    | `read_abs_local()`, `read_abs_data()`, `read_abs_metadata()`                                                                                          | Spreadsheet parser                                          | Shipped as the public parser in v0.2.0                          |
| ABS helpers                        | `separate_series()`, `check_latest_date()`                                                                                                            | Directory                                                   | `SeriesEnd` answers the latest date without a download          |
| ABS Data Cubes                     | `download_abs_data_cube()`, `search_catalogues()`, `show_available_catalogues()`, `get_available_files()`, `show_available_files()`, `search_files()` | Release page links                                          | No API lists Data Cubes. Some cube content is in Data API flows |
| Labour Force cubes and gross flows | `get_available_lfs_cubes()`, `read_lfs_datacube()`, `read_lfs_grossflows()`                                                                           | Release page links                                          | No Data API flow for gross flows or `6291.0.55.001`             |
| ABS convenience                    | `read_cpi()`, `read_awe()`, `read_erp()`                                                                                                              | Directory by series ID                                      | Also in Data API flows `CPI`, `AWE`, `ERP_Q`                    |
| Payroll and job mobility           | `read_payrolls()`, `read_job_mobility()`                                                                                                              | Release page links                                          | No Data API flow                                                |
| ABS SDMX                           | `read_api()`, `read_api_url()`, `read_api_dataflows()`, `read_api_datastructure()`                                                                    | Data API                                                    | The only browser route, and Census and regional data            |
| RBA by table                       | `read_rba()`, `read_rba_local()`, `tidy_rba()`                                                                                                        | RBA spreadsheets                                            | Full precision. CSV files are rounded                           |
| RBA by series ID                   | `read_rba_seriesid()`                                                                                                                                 | Series Index, then spreadsheet                              | No RBA lookup service                                           |
| RBA browse                         | `browse_rba_series()`, `browse_rba_tables()`                                                                                                          | Series Index                                                | Same index as the TUI picker                                    |
| Cash rate                          | `read_cashrate()`, `rba_cashrate()`                                                                                                                   | Table F1 (`FIRMMCRTD`, `FIRMMCRID`)                         | The cash rate page is HTML                                      |
| SMP forecasts                      | `read_forecasts()`, `rba_forecasts()`                                                                                                                 | `smp-forecast-archive.xlsx` plus the forecasts archive page | `readrba` also bundles a 2012 research dataset                  |
| Pipe                               | `%>%`                                                                                                                                                 | Not applicable                                              | R only                                                          |

## Route Comparison

| Criterion                  | ABS spreadsheets                                                           | ABS Data API                                                                       | RBA spreadsheets                                         | RBA CSV                                                                        |
| -------------------------- | -------------------------------------------------------------------------- | ---------------------------------------------------------------------------------- | -------------------------------------------------------- | ------------------------------------------------------------------------------ |
| Coverage                   | All time series spreadsheets                                               | About half of Labour Force and 60 percent of WPI series, plus non-spreadsheet data | All tables, `.xls` for 7                                 | 168 data files, F11.1 missing, E3 2018 missing                                 |
| Series ID and table number | Yes                                                                        | No                                                                                 | Yes                                                      | Yes                                                                            |
| Metadata                   | Unit, type, data type, frequency, collection month                         | Codes with labels, unit multiplier, status                                         | Title, description, frequency, type, units, source, date | Same labels, date as text                                                      |
| Values                     | 8 significant digits                                                       | 9 significant digits                                                               | Full stored precision                                    | Rounded to display                                                             |
| Parse dependency           | SheetJS (1.0 MB ESM, 280 KB `mini` build)                                  | `JSON.parse` or a CSV split                                                        | SheetJS, BIFF for `.xls`                                 | A CSV split plus a Windows-1252 decoder (`TextDecoder` in all target runtimes) |
| Stability                  | No retirement announced, few core layout fixes in the `readabs` change log | Beta, non-production flags, versions change                                        | Changes announced by RSS                                 | As spreadsheets, plus encoding drift                                           |
| CORS                       | No                                                                         | Yes                                                                                | No                                                       | No                                                                             |
| Freshness                  | 304 and 302                                                                | None reliable                                                                      | 304                                                      | 304                                                                            |

Sources: the sections above, [abs-api-guide], [rba-changes], and
[cowgill-doc] for the `readabs` change history.

## Recommendation

**What should a TUI-first Australian economics tool build on?** Three
constraints decide it. Coverage and identity decide the ABS route, precision
decides the RBA route, and the cost of listing decides discovery.

### ABS

Build on the Time Series Directory and time series spreadsheets, as v0.1.0
and v0.2.0 do. They are the only route with series IDs, table numbers, and
full time series coverage, and they match what `readabs` users type. The
trade-offs are SheetJS weight, whole-table downloads for one series, and no
browser access without a proxy.

Treat the Data API as a later, separate source for data that has no
spreadsheet (Census, regions) and for a browser build. Do not map series IDs
onto SDMX keys: no published mapping exists, and the Data API is a beta.

Treat Data Cubes, Payroll Jobs, and gross flows as scraping work with its own
risk, after the core.

### RBA

Read the spreadsheets for values. Use SheetJS, which already reads BIFF, so
the seven current `.xls` tables need no new dependency. Do not read values
from the CSV files: they round, and `readrba` users would see different
numbers. The CSV files stay useful at build time, where their small size and
plain headers make the Series Index cheaper to build.

### Discovery and Model

Ship one generated Series Index that covers both sources. Give each series a
source-prefixed ID and the shared fields above. Refresh it with
`If-Modified-Since` and the Directory's `ProductReleaseDate`, not with runtime
scraping. Let the TUI search the index locally and fetch only the table it
needs.

## Changes to the Release Plan

The current v0.3.0 plan is: RBA Current Tables only, `.xlsx` through the
existing SheetJS reader, a bundled Series Index of table URLs and series IDs,
and no runtime HTML scraping.

1. **Keep spreadsheets, and include `.xls`.** ADR 0003 picks SheetJS but does
   not limit the project to `.xlsx` [adr-0003]. SheetJS read `e03hist.xls`
   in this check. Seven Current Tables, including F11.1 daily exchange rates
   and E3 to E7, are `.xls`. Without them, v0.3.0 misses F11.1 and D9, which
   `readrba` does not mark unreadable. `readrba` marks E3 to E7 unreadable,
   so reading them goes beyond parity.
2. **Do not switch to CSV for values.** The earlier survey's CSV option rests
   on an assumption that this check disproved.
3. **Widen the Series Index.** Add description, units, type, and frequency
   to each row, so the TUI can search it. Plan it as a cross-source index,
   with ABS rows from a build-time Directory crawl, even if v0.3.0 ships only
   RBA rows. The glossary defines the Series Index as RBA-only.
4. **Decide the identifier scheme now.** v0.2.0 left per-source metadata to
   v0.3.0. A source prefix on series IDs and one Series shape with optional
   per-source fields fit both sources.
5. **Store `Last-Modified` per table** in the index or cache, so later
   releases can add a "what's new" view without a format change.
6. **Check the RBA data terms** before bundling RBA metadata, as the earlier
   survey flagged ([cowgill-doc], section "Licence and Attribution").

## References

- `cowgill-doc`: [cowgill-r-packages.md](cowgill-r-packages.md)
- `adr-0003`: [0003-sheetjs-from-vendor-tarball.md](../adr/0003-sheetjs-from-vendor-tarball.md)
- `readabs-ns`: <https://github.com/MattCowgill/readabs/blob/HEAD/NAMESPACE>
- `readrba-ns`: <https://github.com/MattCowgill/readrba/blob/HEAD/NAMESPACE>
- `abs-apis`: <https://www.abs.gov.au/about/data-services/application-programming-interfaces-apis>
- `abs-api-guide`: <https://www.abs.gov.au/about/data-services/application-programming-interfaces-apis/data-api-user-guide>
- `abs-indicator-api`: <https://www.abs.gov.au/about/data-services/application-programming-interfaces-apis/indicator-api>
- `abs-indicator-probe`: <https://indicator.api.abs.gov.au/v1/data>
- `abs-tsd-api`: <https://www.abs.gov.au/about/data-services/application-programming-interfaces-apis/time-series-directory-api>
- `abs-tsd-sid`: <https://www.abs.gov.au/servlet/TSSearchServlet?sid=A84423050A>
- `abs-tsd-cpi`: <https://www.abs.gov.au/servlet/TSSearchServlet?sid=A130393720C>
- `abs-tsd-catno`: <https://www.abs.gov.au/servlet/TSSearchServlet?catno=6202.0>
- `abs-lf-table1`: <https://www.abs.gov.au/statistics/labour/employment-and-unemployment/labour-force-australia/latest-release/62020001.xlsx>
- `abs-lfd-release`: <https://www.abs.gov.au/statistics/labour/employment-and-unemployment/labour-force-australia-detailed/latest-release>
- `abs-lfs-changes`: <https://www.abs.gov.au/statistics/detailed-methodology-information/information-papers/upcoming-changes-labour-force-survey-outputs>
- `abs-release-calendar`: <https://www.abs.gov.au/release-calendar/future-releases>
- `abs-dataflows`: <https://data.api.abs.gov.au/rest/dataflow/ABS>
- `abs-dsd-lf`: <https://data.api.abs.gov.au/rest/dataflow/ABS/LF?references=all>
- `abs-data-lf`: <https://data.api.abs.gov.au/rest/data/ABS,LF,1.0.0/M13.3.1599.20.AUS.M>
- `rba-statistics`: <https://www.rba.gov.au/statistics/>
- `rba-tables`: <https://www.rba.gov.au/statistics/tables/>
- `rba-historical`: <https://www.rba.gov.au/statistics/historical-data.html>
- `rba-changes`: <https://www.rba.gov.au/statistics/tables/changes-to-tables.html>
- `rba-sitemap`: <https://www.rba.gov.au/sitemap.xml>
- `rba-rss`: <https://www.rba.gov.au/updates/rss-feeds.html>
- `rba-rss-changes`: <https://www.rba.gov.au/rss/rss-cb-changes-to-tables.xml>
- `rba-rss-fx`: <https://www.rba.gov.au/rss/rss-cb-exchange-rates.xml>
- `rba-schedule`: <https://www.rba.gov.au/schedules-events/schedule.html>
- `rba-smp-forecasts`: <https://www.rba.gov.au/statistics/xls/smp-forecast-archive.xlsx>
- `rba-cash-rate`: <https://www.rba.gov.au/statistics/cash-rate/>
- `rba-g1-csv`: <https://www.rba.gov.au/statistics/tables/csv/g1-data.csv>
- `rba-g1-xlsx`: <https://www.rba.gov.au/statistics/tables/xls/g01hist.xlsx>
- `rba-d2-csv`: <https://www.rba.gov.au/statistics/tables/csv/d2-data.csv>
- `rba-d2-xlsx`: <https://www.rba.gov.au/statistics/tables/xls/d02hist.xlsx>
- `rba-f11-csv`: <https://www.rba.gov.au/statistics/tables/csv/f1.1-data.csv>
- `rba-f11-xlsx`: <https://www.rba.gov.au/statistics/tables/xls/f01hist.xlsx>
