# Cowgill R Packages

This note surveys the open-source R packages by Matt Cowgill (GitHub
`MattCowgill`) that read Australian economic data. It is for the team that
plans a TypeScript port, and it ends with a recommended v0.1.0 scope. All
observations were made on 2026-10-27 against the live repositories, CRAN, and
upstream endpoints.

---

## Contents

- [Method](#method)
- [Package Inventory](#package-inventory)
- [readabs](#readabs)
- [readrba](#readrba)
- [Smaller Data-Access Packages](#smaller-data-access-packages)
- [Upstream Endpoint Checks](#upstream-endpoint-checks)
- [Hard Parts for a TypeScript Port](#hard-parts-for-a-typescript-port)
- [Licence and Attribution](#licence-and-attribution)
- [Prior Art](#prior-art)
- [Recommended v0.1.0 Scope](#recommended-v010-scope)
- [References](#references)

## Method

The repository list came from `gh repo list MattCowgill --limit 200`.
For each package, the `DESCRIPTION`, `NAMESPACE`, `LICENSE`, `NEWS.md`, and
`R/` sources were read through the GitHub contents API. CRAN status came from
each package's CRAN index page. Upstream behaviour was checked with `curl`
requests to the ABS and Reserve Bank of Australia (RBA) endpoints that the
packages call. A downloaded ABS workbook was opened with `openpyxl` to confirm
its layout.

## Package Inventory

The account holds 28 non-fork repositories [gh-list]. The task brief guessed
at `readlfs`, `readaec`, and `djprshiny`. No `readlfs` or `readaec` repository
exists under `MattCowgill`, and neither name exists on CRAN. Labour Force data
cube support lives inside `readabs` as `read_lfs_datacube()` and
`read_lfs_grossflows()` [readabs-ns]. `djprshiny` belongs to the
`djsir-data` organisation, was last pushed on 2023-05-11, and is not a Cowgill
repository [djprshiny].

The tables below cover the 13 repositories that are R packages for data or
charts. The other 15 were reviewed and excluded because they are Shiny apps,
personal setup, themes, or analysis projects: `wilma` (a Shiny lens on
Australian macro data), `cowgillr`, `ggrichlegend`, `jptheme`, `cricsheetr`,
`arcfooty`, `saulifier`, `paulifier`, `readabs_venables`, `MattCowgill`,
`mattcowgill_dotcom`, `shiny_income_1718`, `shiny_income_dist`,
`similar_countries`, and `Replication-No-one-left-behind` [gh-list].

### Data-Access Packages

| Package | Version | CRAN | Last push | Upstream source | Portability |
| --- | --- | --- | --- | --- | --- |
| `readabs` | 0.4.30 | Yes, published 2026-05-17 | 2026-05-15 | ABS Time Series Directory, ABS spreadsheets, ABS Data API | High value, moderate effort |
| `readrba` | 0.1.12 | Yes, published 2025-08-18 | 2026-05-17 | RBA statistical tables, SMP forecasts | High value, low to moderate effort |
| `readjsa` | 0.0.1 | No | 2025-06-09 | Jobs and Skills Australia, DEWR SALM files | Moderate |
| `rbatext` | 0.0.1 | No | 2025-04-27 | Scraped RBA monetary policy pages, bundled text | Low value for a data port |
| `readeba` | 0.0.0.9001 | No | 2025-03-04 | One Fair Work Commission xlsx file | Small, easy |
| `readweo` | 0.0.0.9001 | No | 2023-07-13 | IMF World Economic Outlook files | Small, not Australian-specific |
| `readstatsnz` | 0.0.0.9001 | No | 2023-02-21 | Stats NZ bulk CSV page | Not Australian |
| `readmits` | 0.0.2 | No | 2023-02-14 | Melbourne Institute portal behind a login, driven by RSelenium | Not portable |
| `cash-rate-scraper` | None | No | 2026-10-26 | RBA cash rate | A repository with no `DESCRIPTION`, so not a package |

Sources: [gh-list], [cran-readabs], [cran-readrba], each package's
`DESCRIPTION` ([readjsa-desc], [rbatext-desc], [readeba-desc],
[readweo-desc], [readmits-desc]), and URLs found in each package's `R/`
directory. `readmits` imports `RSelenium` and targets
`https://www.online.fbe.unimelb.edu.au/miss/Login.aspx` [readmits-desc].
All smaller packages list Matt Cowgill as sole author and maintainer, except
`readjsa`, which lists Angus Hughes and Amee McMillan as contributors
[readjsa-desc].

### Visualisation and Other Packages

| Package | Version | Status | Exports | Port relevance |
| --- | --- | --- | --- | --- |
| `ggannotate` | 1.0.0 | Not on CRAN, last push 2026-03-21, 406 stars | `ggannotate()`, `make_layer()` | None. It is a Shiny gadget for `ggplot2`. |
| `ggdirectlabel` | 0.1.0.901 | Not on CRAN, last push 2023-08-11 | `geom_finallabel()`, `geom_linepoint()`, `geom_richlegend()`, date scales | None. It extends `ggplot2`. |
| `strayr` | 0.0.2 | Archived in the Cowgill account. Active fork at `runapp-aus/strayr`. GPL-3 | `clean_state()`, `is_holiday()`, `strayr()` | Possible later helper. GPL-3 blocks direct code reuse in an MIT port. |
| `auseconhist` | 0.0.0.9000 | Not on CRAN, last push 2020-09-10 | Historical data sets | None for v0.1.0 |

Sources: [ggannotate-readme], each package's `NAMESPACE` and `DESCRIPTION`
in [gh-list], [strayr-runapp]. CRAN returns "Object not found" for both
`ggannotate` and `strayr` [cran-ggannotate].

## readabs

`readabs` downloads, imports, and tidies ABS time series [readabs-desc]. It is
the most mature package in the set. The maintainer is Matt Cowgill. Authors are
Zoe Meers, Jaron Lee, and David Diviny. Contributors are Hugh Parsonage, Kinto
Behr, Angus Moore, and Francis Markham [readabs-desc]. The repository has 112
stars and 17 open issues [readabs-issues]. Recent commits are mostly internal
data refreshes (2025-05, 2025-09, 2025-12, 2026-05) [readabs-commits].

### Exported Functions

`readabs` exports 29 functions [readabs-ns]. They fall into these groups:

| Group | Functions | Mechanism |
| --- | --- | --- |
| Core time series | `read_abs()`, `read_abs_series()`, `read_abs_url()`, `read_abs_local()`, `extract_abs_sheets()`, `tidy_abs()`, `tidy_abs_list()`, `separate_series()`, `check_latest_date()` | Time Series Directory XML, then xlsx workbooks |
| Legacy local readers | `read_abs_data()` (deprecated in favour of `read_abs_local()`), `read_abs_metadata()` | Read a local workbook sheet directly |
| Data cubes | `download_abs_data_cube()`, `search_catalogues()`, `show_available_catalogues()`, `get_available_files()`, `show_available_files()`, `search_files()`, `get_available_lfs_cubes()`, `read_lfs_datacube()`, `read_lfs_grossflows()` | Scraping of `abs.gov.au` HTML with CSS selectors |
| Convenience | `read_cpi()`, `read_awe()`, `read_erp()`, `read_job_mobility()`, `read_payrolls()` | Wrappers over the core or data cubes, with hard-coded series IDs or page selectors |
| Data API | `read_api()`, `read_api_url()`, `read_api_dataflows()`, `read_api_datastructure()` | SDMX REST at `data.api.abs.gov.au` |

### read_abs Signature and Output

The signature is [readabs-read-abs]:

```r
read_abs(cat_no = NULL, tables = "all", series_id = NULL,
         path = Sys.getenv("R_READABS_PATH", unset = tempdir()),
         metadata = TRUE, show_progress_bars = TRUE, retain_files = TRUE,
         check_local = TRUE, release_date = "latest")
```

The caller supplies either `cat_no` (for example `"6345.0"`) or `series_id`
(for example `"A84423050A"`), never both. A `cat_no` shorter than six
characters gets `".0"` appended. `tables` filters by table number, and the
package matches the number against the `TableTitle` text with a regex that
requires a preceding space or `0` and a following `.`, space, or `:`
[readabs-read-abs].

With `metadata = TRUE`, the result is one long tibble with these columns
[readabs-tidy-abs] [readabs-tidy-list]:

| Column | Source |
| --- | --- |
| `table_no` | Workbook filename without extension, for example `634501` |
| `sheet_no` | Worksheet name, for example `Data1` |
| `table_title` | `TableTitle` from the Time Series Directory |
| `date` | Column A, Excel serial converted with origin `1899-12-30` |
| `series` | Row 1 header text, for example `Quarterly Index ;  Total hourly rates ... ;` |
| `value` | Numeric cell value |
| `series_type` | Metadata row `Series Type` |
| `data_type` | Metadata row `Data Type` |
| `collection_month` | Metadata row `Collection Month` |
| `frequency` | Metadata row `Frequency` |
| `series_id` | Metadata row `Series ID` |
| `unit` | Metadata row `Unit` |

With `metadata = FALSE`, the result has only `date`, `series_id`, and `value`
[readabs-tidy-abs].

### Time Series Directory Mechanics

`read_abs()` does not scrape release pages. It queries the ABS Time Series
Directory (TSD), an XML index of every time series spreadsheet
[readabs-tsd-url]:

```text
https://ausstats.abs.gov.au/servlet/TSSearchServlet?catno=6345.0&ttitle=1
https://ausstats.abs.gov.au/servlet/TSSearchServlet?sid=A84423050A
```

The ABS documents the base URL as `https://abs.gov.au/servlet/TSSearchServlet?`
with parameters `ptitle`, `ttitle`, `sid`, `catno`, and `pg`. Results come in
pages of 100 series. A `*` wildcard works only at the end of a value
[abs-tsd-doc]. The page was released on 16/12/2025 and states no deprecation
[abs-tsd-doc].

Each `<Series>` element carries `ProductNumber`, `ProductTitle`,
`ProductIssue`, `ProductReleaseDate`, `ProductURL`, `TableURL`, `TableTitle`,
`TableOrder`, `Description`, `Unit`, `SeriesType`, `DataType`, `Frequency`,
`CollectionMonth`, `SeriesStart`, `SeriesEnd`, `NoObs`, and `SeriesID`
(observed in a live response, see
[Upstream Endpoint Checks](#upstream-endpoint-checks)).

The package logic is [readabs-xml-meta] [readabs-xml-dfs]:

1. Fetch page 1 and read `NumPages`. Treat a missing `NumPages` as one page.
2. Fetch pages 2 to `NumPages` with `&pg=N`.
3. If a `ttitle` query fails, retry with a leading zero (`ttitle=01`), because
   some products name tables `Table 01`.
4. Parse `ProductIssue` with `%d %b %Y` after prefixing `01`. Parse
   `ProductReleaseDate`, `SeriesStart`, and `SeriesEnd` as `%d/%m/%Y`.
5. Keep only rows from the latest `ProductReleaseDate` per table. For a
   `series_id` query, keep one row per `SeriesID`.
6. Replace spaces in `TableURL` with `+`. If the `.xlsx` download fails,
   retry with `.xls` [readabs-read-abs].
7. For `release_date`, replace `latest-release` in the URL with a lowercase
   `mon-yyyy` string. The documentation says this works reliably only for
   monthly and some quarterly data, and fails before about mid-2019
   [readabs-read-abs]. Issue #264 reports inconsistent URLs for previous
   releases [readabs-issues].

### Workbook Layout and Tidying

`extract_abs_sheets()` reads every worksheet except `Index`, `Inquiries`,
`Enquiries`, `Contents`, `Technical note(s)`, `Note(s)`, and any sheet whose
name contains `Table` followed by a space [readabs-extract].

An ABS time series sheet has this layout. It was confirmed in
`634501.xlsx`, sheet `Data1`:

| Excel row | Column A | Columns B onward |
| --- | --- | --- |
| 1 | Blank | Series description, used as `series` |
| 2 | `Unit` | `Index Numbers` |
| 3 | `Series Type` | `Original` |
| 4 | `Data Type` | `INDEX` |
| 5 | `Frequency` | `Quarter` |
| 6 | `Collection Month` | `3` |
| 7 | `Series Start` | Date cell |
| 8 | `Series End` | Date cell |
| 9 | `No. Obs` | `116` |
| 10 | `Series ID` | `A2603039T` |
| 11 onward | Date cell | Numeric values |

`tidy_abs()` checks `df[9, 1] == "Series ID"`. The index is 9, not 10, because
`readxl` consumes Excel row 1 as column names [readabs-tidy-abs]. A port that
reads raw rows must check row 10. The function also drops rows whose first
cell contains `Trend Break` or `see`, because the ABS sometimes appends notes
below the data [readabs-tidy-abs]. Duplicate series descriptions are made
unique by appending the series ID before pivoting, then stripped with the
regex `_[^_]+$` [readabs-tidy-abs].

Dates are the first day of the period's final month. The September 1997
quarter is `1997-09-01` in the workbook.

### Caching and Configuration

Downloads go to `R_READABS_PATH` or the R temp directory, in a subdirectory
per catalogue number. When the full catalogue is read, the tidy result is also
written as an `fst` file, and `check_local = TRUE` reuses it on later calls
without checking freshness [readabs-read-abs]. `R_READABS_DL_METHOD` lets
corporate users switch the download method [readabs-dl]. Every request sends
the User-Agent `readabs R package - https://mattcowgill.github.io/readabs/index.html`
[readabs-internal].

### Data Cubes and Convenience Functions

The data cube functions depend on a bundled `abs_lookup_table`. The build
script creates it by scraping `https://www.abs.gov.au/statistics` with the CSS
selector `.layout__region--content .card` and then each sub-page
[readabs-scrape-cat] [readabs-internal]. `show_available_files()` scrapes
`.file a` and `.file-description-link-left, .abs-data-download-left` on each
release page [readabs-show-files]. `read_payrolls()` uses a long
`nth-child` CSS path to find the previous release [readabs-payrolls].

The NEWS log shows that these functions break most often. Entries mention
fixes for ABS changes to Payroll Jobs (0.4.9, 0.4.11, 0.4.14, 0.4.18), data
cubes for the new ABS website (0.4.5), and a breaking `read_cpi()` change for
the monthly CPI (0.4.30) [readabs-news]. The core `tidy_abs()` logic has had
few changes. 0.4.19 added a fix for extra non-data worksheets and 0.4.11
adapted to unannounced spreadsheet changes [readabs-news].

`read_cpi()` now takes `frequency = c("quarterly", "monthly")` and maps to
series `A2325846C` or `A130393720C`. It asserts that the series name equals
`Index Numbers ;  All groups CPI ;  Australia ;` [readabs-cpi].

### Data API Functions

`read_api()` builds SDMX REST URLs under `https://data.api.abs.gov.au/rest/`,
requests `application/vnd.sdmx.data+csv`, and labels codes with the data
structure fetched from `rest/dataflow/ABS/{id}?references=all` (XML)
[readabs-api]. The NEWS log marks these functions as experimental and records
a fix for a changed ABS API URL in 0.4.18 [readabs-news]. Issue #277 reports
that the functions fail on systems that block `curl` [readabs-issues].

`read_api_dataflows()` reads `r$references` from the response, which implies a
JSON body [readabs-api]. The live endpoint now returns
`application/vnd.sdmx.structure+xml` by default (see
[Upstream Endpoint Checks](#upstream-endpoint-checks)). A port must send an
explicit `Accept` header.

## readrba

`readrba` downloads current and historical RBA statistical tables and SMP
forecasts into a tidy data frame [readrba-desc]. The maintainer is Matt
Cowgill, with Angus Moore as contributor. Version 0.1.12 was published on CRAN
on 2025-08-18 [cran-readrba]. The repository has 30 stars and 3 open issues.

### Exported Functions

The exports are `read_rba()`, `read_rba_seriesid()`, `read_rba_local()`,
`tidy_rba()`, `browse_rba_series()`, `browse_rba_tables()`,
`read_cashrate()`, `rba_cashrate()`, `read_forecasts()`, `rba_forecasts()`,
and the re-exported `%>%` [readrba-ns].

### read_rba Signature and Output

```r
read_rba(table_no = NULL, cur_hist = "current", series_id = NULL,
         path = tempdir(), update_urls = FALSE)
```

A `series_id` call looks up table numbers and `cur_hist` values in the bundled
`series_list` [readrba-read]. The output columns are `date`, `series`,
`value`, `frequency`, `series_type`, `units`, `source`, `pub_date`,
`series_id`, `description`, and `table_title` [readrba-tidy].
`read_cashrate()` reads series `FIRMMCRTD` (target) and `FIRMMCRID`
(interbank) and returns `date`, `series`, and `value` [readrba-cashrate].

### Table Discovery and Bundled Lookups

`scrape_table_list()` reads `https://www.rba.gov.au/statistics/tables/` with
selector `#tables-list li a` and
`https://www.rba.gov.au/statistics/historical-data.html` with selector
`.width-text li a`. It keeps links containing `xls` and splits the link text on
the last en dash into a title and table number [readrba-scrape]. Some
historical exchange rate files have no table number, so the package invents
IDs such as `ex_daily_8386` [readrba-scrape].

The build script then downloads every readable table to build `series_list`,
one row per series with `table_no`, `series`, `series_id`, `series_type`,
`table_title`, `cur_hist`, `description`, and `frequency`
[readrba-internal]. `browse_rba_series()` and `browse_rba_tables()` filter
these bundled tables with a case-insensitive `grepl` across all columns
[readrba-browse]. If a stored URL fails, `get_rba_urls()` re-scrapes the
listing page [readrba-urls].

Tables that the package marks unreadable are current `E3` to `E7` and
historical `A3`, `J1`, `J2`, `E4` to `E7`, `F16`, and `F17`
[readrba-scrape].

### Sheet Parsing

`load_rba_sheet()` renames a file when its extension does not match its
signature, because the RBA serves some `.xls` files that are really xlsx. It
skips sheets named `Notes`, `Series breaks`, `AGS - Notes`, and `Use of Expert
Judgement` [readrba-load].

`tidy_rba()` expects first-column labels `Title`, `Description`, `Frequency`,
`Type`, `Units`, `Source`, `Publication date`, and `Series ID` (or
`Mnemonic`) [readrba-tidy] [readrba-check]. It contains four special cases:

- Old `F16` and `F2` sheets get synthetic metadata rows.
- `A5` gets synthetic title and description rows.
- The 1992 to 2008 zero-coupon table gets synthetic metadata.
- A blank label beside a date in row 9 becomes `Publication date`.

Sources: [readrba-prelim], [readrba-tidy].

Date cells can be `dd-Mon-yyyy` strings, `dd/mm/yyyy` strings, Excel serials
stored as text, or a mix within one column [readrba-tidy].
`rba_value_to_num()` converts en dashes and the Unicode minus sign to `-`,
converts `1/2`, `1/4`, and `3/4` glyphs to decimals, and turns ranges such as
`17 to 17.5` into their mean [readrba-value]. The function also rewrites
`Commonwealth Government` to `Australian Government` in series names
[readrba-tidy].

### Forecasts

`read_forecasts()` combines a bundled historical set (from
`forecast-date-by-event-date.xls`, Tulip and Wallace RDP 2012-07) with recent
forecasts scraped from
`https://www.rba.gov.au/publications/smp/forecasts-archive.html` and
`https://www.rba.gov.au/statistics/xls/smp-forecast-archive.xlsx`
[readrba-forecasts] [readrba-internal]. NEWS records format fixes in 0.1.8 and
0.1.9 [readrba-news].

## Smaller Data-Access Packages

| Package | Exports | Source URLs in code |
| --- | --- | --- |
| `readjsa` | `read_ivi()`, `read_reos()`, `read_salm()` | `https://www.jobsandskills.gov.au/sites/default/files/`, `https://www.dewr.gov.au/employment-research/small-area-labour-markets` |
| `readeba` | `read_fwc()` | `https://www.fwc.gov.au/documents/reporting/enterprise-agreements-data.xlsx` |
| `readweo` | `read_weo()` | `https://www.imf.org/-/media/Files/Publications/WEO/WEO-Database/` |
| `rbatext` | `read_rba_decisions()`, `read_rba_minutes()` | `https://www.rba.gov.au/monetary-policy/`, `https://www.rba.gov.au/statistics/cash-rate/` |
| `readstatsnz` | `read_statsnz()`, `show_available_csvs()` | `https://www.stats.govt.nz/large-datasets/csv-files-for-download` |
| `readmits` | `read_mits()` | Login page for the Melbourne Institute portal |

Sources: each package's `NAMESPACE` and `R/` directory in [gh-list]. Several
of these still carry the `usethis` template title "What the Package Does"
in `DESCRIPTION` (`readweo`, `readstatsnz`, `ggdirectlabel`), and `readmits`
has the template description [readweo-desc] [readmits-desc]. Treat them as
personal tools.

## Upstream Endpoint Checks

All checks ran on 2026-10-27 with `curl`.

### ABS Time Series Directory

| Request | Result |
| --- | --- |
| `ausstats.abs.gov.au/servlet/TSSearchServlet?catno=6345.0&ttitle=1` | 301 to `www.ausstats.abs.gov.au:443`, then 200 `text/xml`, 27 series, no `NumPages` element |
| `abs.gov.au/servlet/TSSearchServlet?sid=A84423050A` | 301 to `www.abs.gov.au:443`, then 200, 4 series from 6202.0, `ProductIssue` `Sep 2026` |
| `...?catno=6202.0` | 100 series on page 1, `NumPages` 113, total 11,295 series |
| `...?catno=6401.0` | 200, `NumPages` 102, `ProductIssue` `August 2026` |
| `...?sid=A2325846C` | 6401.0, table `6401017.xlsx`, series end `01/06/2026` |
| `...?sid=A2325807L` | Empty `<TimeSeriesIndex />` |

These results matter for a port:

- The client must follow cross-host redirects.
- `ProductIssue` uses abbreviated months for some products (`Sep 2026`) and
  full months for others (`August 2026`). A TypeScript parser must accept
  both.
- `A2325807L` is a CPI example in the `read_abs()` documentation
  [readabs-read-abs]. The TSD now returns nothing for it. Series IDs can
  retire without notice, and an empty result is not an HTTP error.
- The latest CPI release page states: "This release previously used
  catalogue number 6401.0" [abs-cpi-latest]. The TSD still answers
  `catno=6401.0` with August 2026 data. Catalogue-number queries still work,
  but release pages no longer present the number as current.
- All 100 table URLs on page 1 of 6202.0 are `.xlsx`.

### ABS Spreadsheets

`.../wage-price-index-australia/latest-release/634501.xlsx` returns 302 to
`.../jun-2026/634501.xlsx`, which returns 200 with the xlsx content type. A
request with an empty User-Agent returns 403. The User-Agents `node` and the
`readabs` string both succeed. No `Access-Control-Allow-Origin` header is
present on the spreadsheet or the TSD response.

### ABS Data API

The ABS documents the base URL `https://data.api.abs.gov.au/rest/`, no API key,
SDMX 2.1, and XML, JSON, and CSV formats [abs-api-guide]. A major update on 29
November 2024 moved the path from `api.data.abs.gov.au/data/` to
`data.api.abs.gov.au/rest/data/` and removed API keys [abs-api-guide]. The
guide calls the service a beta whose availability "is not guaranteed"
[abs-api-guide].

`GET rest/data/ABS,CPI/all?startPeriod=2026-01&detail=dataonly` with
`Accept: application/vnd.sdmx.data+csv` returned 200 with the dataflow
`ABS:CPI(2.0.0)` and monthly rows. `GET rest/dataflow/ABS` returned
`application/vnd.sdmx.structure+xml` from "NSI Web Service v8.19.9.0". A GET
with an `Origin` header returned a matching `Access-Control-Allow-Origin`, so
the Data API works from a browser. `HEAD` returns 405.

### ABS CPI Change

The ABS started the complete Monthly CPI publication on 26 November 2025,
with the October 2025 reference month. The ABS continues a quarterly CPI
series, calculated as the average of the three monthly figures. The Monthly
CPI Indicator was not published after the 29 October 2025 release
[abs-cpi-media]. The latest release (August 2026, released 30/09/2026) is
the monthly CPI [abs-cpi-latest]. `readabs` 0.4.30 reacted with a breaking
`read_cpi()` change [readabs-news].

### RBA Statistical Tables

The current tables page returned 200 and links 221 `.csv`, 87 `.xlsx`, and 7
`.xls` files. The historical page links 37 `.xls`, 1 `.xlsx`, and 2 `.csv`
files. `readrba` reads only the spreadsheets. It does not use the CSV files.

`csv/f1.1-data.csv` is UTF-8 with a byte order mark. Row 1 is the table title
(`F1.1 INTEREST RATES AND YIELDS - MONEY MARKET`, with an en dash in the
original). The next rows are `Title`, `Description`, `Frequency`, `Type`,
`Units`, two blank rows, `Source`, `Publication date` (`01-Oct-2026`), and
`Series ID`. Data rows use `dd/mm/yyyy`. Rows are ragged, so trailing empty
cells are omitted. Series IDs in F1.1 are monthly (`FIRMMCRT`), while
`read_cashrate()` uses the daily `FIRMMCRTD` from F1 [readrba-cashrate].

The CSV and xlsx files have no CORS header. `robots.txt` disallows `/assets/`,
`/search/`, and `/s/`, and does not restrict `/statistics/` [rba-robots].

## Hard Parts for a TypeScript Port

| Area | Detail | Suggested approach |
| --- | --- | --- |
| Runtime | ABS spreadsheets, the TSD, and RBA files send no CORS header | Target Node 20+ (or Bun, Deno, or a server worker). Expose only the Data API to browsers, if at all. |
| xlsx parsing | ABS core needs xlsx. RBA historical needs BIFF `.xls`. | `read-excel-file` 9.3.12 (MIT, published 2026-10-07) reads xlsx only. SheetJS reads both, but npm has stale 0.18.5 (2022-03-24). SheetJS documents its CDN as the authoritative source for 0.20.3 [sheetjs-install]. Installing from a CDN tarball is a supply-chain decision for the project. |
| Excel dates | Serial dates with origin `1899-12-30`, date-typed cells, and RBA text dates in three formats | Return ISO `YYYY-MM-DD` strings. Avoid `Date` objects in local time zones. |
| TSD XML | Paginated, flat elements, redirects, empty result for unknown IDs | `fast-xml-parser` 5.11.2 (MIT). Treat an empty index as "not found". |
| Table matching | Regex on `TableTitle`, leading-zero retry | Port `match_tables()` with lookbehind, supported in V8. |
| Tidy reshape | Wide sheet to long rows, unique series keys | Plain loops. No dataframe library needed. |
| Lookup data | `readrba` bundles `series_list` and `table_list`. `readabs` bundles `abs_lookup_table` and old AWE data. | Generate at build time with a script and version the JSON. Note the licence point below. |
| Caching | `fst` files with no freshness check | Defer. Later use `ETag` and `Last-Modified`, which the ABS and RBA both send. |
| Scraping | Data cube and RBA listing functions depend on CSS selectors | Defer data cubes. For RBA, the CSV link list is still scraped HTML. |
| Value parsing | RBA fractions, ranges, en dash and Unicode minus | Port `rba_value_to_num()` with tests. |

The `xlsx` and `read-excel-file` facts come from the npm registry
[npm-xlsx] [npm-rxf]. The `fast-xml-parser` version comes from [npm-fxp].

## Licence and Attribution

### Code

`readabs` and `readrba` use `MIT + file LICENSE` [readabs-desc]
[readrba-desc]. The CRAN-style stub names the copyright holders:

- `readabs`: `YEAR:2018`, `COPYRIGHT HOLDER: Zoe Meers and Matt Cowgill`
  [readabs-license].
- `readrba`: `YEAR: 2020`, `COPYRIGHT HOLDER: Matt Cowgill`
  [readrba-license].

GitHub reports `NOASSERTION` for both because the stub is not a full licence
text. A TypeScript port that follows their logic, regexes, and special cases
is a derived work. Ship an MIT licence and keep both copyright notices in a
`NOTICE` or `LICENSE` file. Credit the listed authors and contributors in the
README.

`strayr` is GPL-3 [strayr-desc]. Do not copy its code into an MIT port.

### Data

ABS website material is licensed CC BY 4.0, with exclusions such as logos and
third-party content [abs-copyright]. A port that returns ABS data needs no
licence change, but documentation should tell users to attribute the ABS.

RBA statistical data is excluded from the RBA CC BY 4.0 licence. It falls
under separate Financial Data terms. Attribution must read "Source: Reserve
Bank of Australia [year]" or "Source: RBA [year]" and must not imply RBA
endorsement. Third-party content in RBA tables, such as ABS series, needs that
party's consent. The RBA may change or withdraw data without notice
[rba-copyright].

A port that bundles an RBA-derived `series_list`, as `readrba` does, would
redistribute RBA-derived metadata in the npm tarball. The metadata is titles,
descriptions, and IDs, not observations. Confirm this fits the Financial Data
terms, or fetch the lookup at runtime instead of bundling it.

## Prior Art

- `readabs` on PyPI (0.3.0, `bpalmer4/readabs`) is a separate Python
  implementation that returns pandas data frames [pypi-readabs].
- `@pipeworx/mcp-abs-au` (0.1.6) on npm is an MCP server for the ABS Data API
  [npm-search].
- An npm search for `readabs` found no TypeScript port of `readabs` or
  `readrba` [npm-search].

## Recommended v0.1.0 Scope

### Slice

Port the `read_abs()` core for Node only:

```ts
readAbs({ catNo: "6345.0", tables: ["1"] }): Promise<AbsObservation[]>
readAbs({ seriesId: ["A84423050A"] }): Promise<AbsObservation[]>
```

The slice contains:

1. A TSD client. It follows redirects, paginates by `NumPages`, retries
   `ttitle` with a leading zero, and filters to the latest release.
2. An xlsx fetch with a non-empty User-Agent and redirect following.
3. A sheet extractor that skips non-data sheets and validates `Series ID` in
   Excel row 10.
4. A tidy step that emits rows with the same 12 fields as `readabs`, in
   camelCase (`tableNo`, `sheetNo`, `tableTitle`, `date`, `series`, `value`,
   `seriesType`, `dataType`, `collectionMonth`, `frequency`, `seriesId`,
   `unit`), with `date` as an ISO string.
5. A `metadata: false` option for `date`, `seriesId`, and `value` only.
6. Recorded TSD XML and xlsx fixtures for offline tests, plus one opt-in live
   test per endpoint.

### Rationale

- The core needs two upstream endpoints. Both are stable and documented
  [abs-tsd-doc].
- The core has changed little over the package history. The NEWS log puts
  most breakages in data cube, payroll, and convenience functions
  [readabs-news].
- The output schema is fixed and testable against `readabs` results.
- The slice exercises the hard parts (xlsx, dates, XML pagination) once, and
  later features reuse them.

### Deferred Items

| Deferred item | Reason |
| --- | --- |
| `release_date` | URL rewrite is unreliable for quarterly and annual data, and issue #264 is open |
| Local caching and `check_local` | Needs a freshness design. `fst` has no TypeScript equivalent. |
| `read_abs_local()`, `read_abs_url()` | Small additions once the parser exists |
| `separate_series()` | Pure string helper. Add in v0.2. |
| Data cubes and `read_lfs_*` | Depend on CSS selectors on `abs.gov.au` and on a scraped lookup table |
| `read_cpi()`, `read_payrolls()`, `read_awe()`, `read_erp()`, `read_job_mobility()` | Hard-coded IDs and selectors that break when the ABS changes a release |
| `read_api()` family | Separate SDMX design. It is the only browser-viable ABS path, so it could become its own entry point. |
| `.xls` fallback | All observed ABS TSD URLs were `.xlsx` |
| All of `readrba` | Planned as v0.2 |

### Alternative or v0.2: RBA via CSV

A `readRba({ tableNo })` slice built on the RBA CSV files needs no Excel
parser. The CSV metadata block matches the labels that `tidy_rba()` expects,
and 221 CSV links exist on the current tables page. `browse_rba_series()` and
`readRba({ seriesId })` need a series lookup. Build it at runtime from the
CSV files, or bundle it after the licence check above. Historical tables are
mostly BIFF `.xls`, so defer them.

This slice is smaller than the ABS slice. It was not chosen for v0.1.0 for
three reasons. The project directory name (`abs`) suggests an ABS focus, but
this is an inference. The ABS slice builds the xlsx, date, and XML code that
a later RBA xlsx path can reuse. RBA data carries the stricter licence terms
above.

### Risks

| Risk | Effect | Mitigation |
| --- | --- | --- |
| The TSD host or redirect changes | All core reads fail | Use the documented `abs.gov.au` base and follow redirects. Keep a live smoke test in CI on a schedule. |
| Series IDs retire, as `A2325807L` did | Empty results | Return a typed "not found" error that lists the missing IDs |
| Release pages describe catalogue numbers as previously used | `catNo` queries may stop working in future | Also support `seriesId` from v0.1.0. Track the ABS TSD page. |
| ABS adds notes or extra sheets to workbooks | Parse errors | Port the `Trend Break` and `see` filters and the sheet skip list. Validate row 10. |
| Excel library choice | Supply-chain or format coverage limits | Choose between `read-excel-file` (npm, xlsx only) and SheetJS (CDN) before work starts |
| Empty User-Agent returns 403 | Downloads fail in some runtimes | Always send a project User-Agent |
| Large catalogues | 6202.0 has 113 TSD pages and many workbooks | Encourage `tables` or `seriesId`. Limit concurrency. |

## References

- `gh-list`: <https://github.com/MattCowgill?tab=repositories>
- `djprshiny`: <https://github.com/djsir-data/djprshiny>
- `strayr-runapp`: <https://github.com/runapp-aus/strayr>
- `strayr-desc`: <https://github.com/MattCowgill/strayr/blob/HEAD/DESCRIPTION>
- `ggannotate-readme`: <https://github.com/MattCowgill/ggannotate/blob/HEAD/README.md>
- `cran-readabs`: <https://cran.r-project.org/web/packages/readabs/index.html>
- `cran-readrba`: <https://cran.r-project.org/web/packages/readrba/index.html>
- `cran-ggannotate`: <https://cran.r-project.org/web/packages/ggannotate/index.html>
- `readabs-desc`: <https://github.com/MattCowgill/readabs/blob/HEAD/DESCRIPTION>
- `readabs-license`: <https://github.com/MattCowgill/readabs/blob/HEAD/LICENSE>
- `readabs-ns`: <https://github.com/MattCowgill/readabs/blob/HEAD/NAMESPACE>
- `readabs-news`: <https://github.com/MattCowgill/readabs/blob/HEAD/NEWS.md>
- `readabs-issues`: <https://github.com/MattCowgill/readabs/issues>
- `readabs-commits`: <https://github.com/MattCowgill/readabs/commits>
- `readabs-read-abs`: <https://github.com/MattCowgill/readabs/blob/HEAD/R/read_abs.R>
- `readabs-tsd-url`: <https://github.com/MattCowgill/readabs/blob/HEAD/R/form_abs_tsd_url.R>
- `readabs-xml-meta`: <https://github.com/MattCowgill/readabs/blob/HEAD/R/get_abs_xml_metadata.R>
- `readabs-xml-dfs`: <https://github.com/MattCowgill/readabs/blob/HEAD/R/get_xml_dfs.R>
- `readabs-extract`: <https://github.com/MattCowgill/readabs/blob/HEAD/R/extract_abs_sheets.R>
- `readabs-tidy-abs`: <https://github.com/MattCowgill/readabs/blob/HEAD/R/tidy_abs.R>
- `readabs-tidy-list`: <https://github.com/MattCowgill/readabs/blob/HEAD/R/tidy_abs_list.R>
- `readabs-dl`: <https://github.com/MattCowgill/readabs/blob/HEAD/R/download_abs.R>
- `readabs-internal`: <https://github.com/MattCowgill/readabs/blob/HEAD/data-raw/create_internal_data.r>
- `readabs-scrape-cat`: <https://github.com/MattCowgill/readabs/blob/HEAD/R/scrape_abs_catalogues.r>
- `readabs-show-files`: <https://github.com/MattCowgill/readabs/blob/HEAD/R/show_available_files.r>
- `readabs-payrolls`: <https://github.com/MattCowgill/readabs/blob/HEAD/R/read_payrolls.R>
- `readabs-cpi`: <https://github.com/MattCowgill/readabs/blob/HEAD/R/read_cpi.R>
- `readabs-api`: <https://github.com/MattCowgill/readabs/blob/HEAD/R/read_api.R>
- `readrba-desc`: <https://github.com/MattCowgill/readrba/blob/HEAD/DESCRIPTION>
- `readrba-license`: <https://github.com/MattCowgill/readrba/blob/HEAD/LICENSE>
- `readrba-ns`: <https://github.com/MattCowgill/readrba/blob/HEAD/NAMESPACE>
- `readrba-news`: <https://github.com/MattCowgill/readrba/blob/HEAD/NEWS.md>
- `readrba-read`: <https://github.com/MattCowgill/readrba/blob/HEAD/R/read_rba.R>
- `readrba-urls`: <https://github.com/MattCowgill/readrba/blob/HEAD/R/get_rba_urls.R>
- `readrba-scrape`: <https://github.com/MattCowgill/readrba/blob/HEAD/R/scrape_table_list.R>
- `readrba-load`: <https://github.com/MattCowgill/readrba/blob/HEAD/R/load_rba_sheet.R>
- `readrba-tidy`: <https://github.com/MattCowgill/readrba/blob/HEAD/R/tidy_rba.R>
- `readrba-check`: <https://github.com/MattCowgill/readrba/blob/HEAD/R/check_if_rba_ts.R>
- `readrba-prelim`: <https://github.com/MattCowgill/readrba/blob/HEAD/R/prelim_tidy_rba.R>
- `readrba-value`: <https://github.com/MattCowgill/readrba/blob/HEAD/R/rba_value_to_num.R>
- `readrba-browse`: <https://github.com/MattCowgill/readrba/blob/HEAD/R/browse_data.R>
- `readrba-cashrate`: <https://github.com/MattCowgill/readrba/blob/HEAD/R/read_cashrate.R>
- `readrba-forecasts`: <https://github.com/MattCowgill/readrba/blob/HEAD/R/rba_forecasts.R>
- `readrba-internal`: <https://github.com/MattCowgill/readrba/blob/HEAD/data-raw/internal_data.R>
- `readjsa-desc`: <https://github.com/MattCowgill/readjsa/blob/HEAD/DESCRIPTION>
- `rbatext-desc`: <https://github.com/MattCowgill/rbatext/blob/HEAD/DESCRIPTION>
- `readeba-desc`: <https://github.com/MattCowgill/readeba/blob/HEAD/DESCRIPTION>
- `readweo-desc`: <https://github.com/MattCowgill/readweo/blob/HEAD/DESCRIPTION>
- `readmits-desc`: <https://github.com/MattCowgill/readmits/blob/HEAD/DESCRIPTION>
- `abs-tsd-doc`: <https://www.abs.gov.au/about/data-services/help/abs-time-series-directory>
- `abs-api-guide`: <https://www.abs.gov.au/about/data-services/application-programming-interfaces-apis/data-api-user-guide>
- `abs-cpi-media`: <https://www.abs.gov.au/media-centre/media-statements/abs-announces-monthly-cpi-start-november-2025>
- `abs-cpi-latest`: <https://www.abs.gov.au/statistics/economy/price-indexes-and-inflation/consumer-price-index-australia/latest-release>
- `abs-copyright`: <https://www.abs.gov.au/website-privacy-copyright-and-disclaimer>
- `rba-copyright`: <https://www.rba.gov.au/copyright/>
- `rba-robots`: <https://www.rba.gov.au/robots.txt>
- `sheetjs-install`: <https://docs.sheetjs.com/docs/getting-started/installation/nodejs>
- `npm-xlsx`: <https://registry.npmjs.org/xlsx>
- `npm-rxf`: <https://registry.npmjs.org/read-excel-file>
- `npm-fxp`: <https://registry.npmjs.org/fast-xml-parser>
- `npm-search`: <https://registry.npmjs.org/-/v1/search?text=readabs&size=5>
- `pypi-readabs`: <https://pypi.org/project/readabs/>
