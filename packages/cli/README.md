# `ausecon`

`ausecon` is a command-line tool that reads Australian economic data from the
Australian Bureau of Statistics (ABS) and the Reserve Bank of Australia (RBA).
It ports the `readabs` and `readrba` R packages and uses
[`@ausecon/core`](https://www.npmjs.com/package/@ausecon/core).

---

## Status

The tool is in development. No release exists.

The first release reads ABS time series by catalogue number and table number,
or by series ID. The tool now reads every table of a catalogue number:

```shell
ausecon abs get --catalogue 6345.0 > wages.csv
```

## Install

The tool needs Node 22.18 or later.

```shell
npm install --global ausecon
ausecon --help
```

## Links

- [Source and glossary](https://github.com/jackemcpherson/ausecon)
- [`readabs` R package](https://github.com/MattCowgill/readabs)
- [`readrba` R package](https://github.com/MattCowgill/readrba)

## License

MIT. The license keeps the copyright notices of `readabs` and `readrba`.
