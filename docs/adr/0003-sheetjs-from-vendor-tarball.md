# SheetJS from the Vendor Tarball

The project reads ABS spreadsheets with SheetJS 0.20.3. It installs SheetJS
from the vendor tarball at `cdn.sheetjs.com`, not from the npm registry.

The `xlsx` package on npm stopped at 0.18.5. That release has two open
high-severity advisories: CVE-2023-30533 and CVE-2024-22363. The project chose
SheetJS because it is the most common spreadsheet library.

## Considered Options

- `exceljs`: no release since October 2023, and it depends on Node APIs.
- `read-excel-file`: maintained on npm, but less common.
- A custom reader on a ZIP and XML library: more code to maintain.

## Consequences

Renovate does not update the tarball dependency. Check for new SheetJS
releases by hand. The `bun.lock` file records the tarball integrity hash.
