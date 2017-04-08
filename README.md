# Stylus Supremacy

**Stylus Supremacy** is a **Node.js** script for formatting *Stylus* files. You may say this is a beautifier of *Stylus*.

## Basic usage

First thing first, you must install this script via **NPM** by calling `npm install stylus-supremacy -g`, then calling the below command.
```
node stylus-supremacy ./path/to/your/file.styl
```

In case you want to format multiple files at a time, you can specify a file path in *glob* pattern.
```
node stylus-supremacy ./**/*.styl
```

## Formatting options

The [default formatting options](edge/defaultFormattingOptions.json) will be used, unless you specify your own options explicitly. The parameter `--options` and `-p` can be used interchangably.
```
node stylus-supremacy ./path/to/your/file.styl --options ./path/to/your/options.json
```

|Options|Default value|Possible values|
|---|---|---|
|`insertColons`|`true`|`true` for always inserting a colon after a property name, otherwise `false`.|
|`insertSemicolons`|`true`|`true` for always inserting a semi-colon after a property value, a variable declaration, a variable assignment and a function call, otherwise `false`.|
|`insertBraces`|`true`|`true` for always inserting a pair of curly braces between a selector body, a mixin body, a function body and any @-block bodies, otherwise `false`.|
|`insertNewLineBetweenGroups`|`1`|This represents a number of new-line between different type of groups.|
|`insertNewLineBetweenSelectors`|`false`|`true` for always inserting a new-line between selectors, otherwise `false`.|
|`insertNewLineBeforeElse`|`false`|`true` for always inserting a new-line before *else* keyword, otherwise `false`.|
|`insertSpaceBeforeComment`|`true`|`true` for always inserting a white-space before a comment, otherwise `false`.|
|`insertSpaceAfterComment`|`true`|`true` for always inserting a white-space after a comment, otherwise `false`.|
|`insertParenthesisAroundIfCondition`|`true`|`true` for always inserting a pair of parentheses between *if*-condition, otherwise `false`.|
|`tabStopChar`|`\t`|This represents a tab-stop string. You may change this to 2-white-space sequence or anything.|
|`newLineChar`|`\n`|This represents a new-line character. You may change this to `\r\n` if you are using *Microsoft Windows*.|
|`quoteChar`|`'`|This represents a quote character that is used to begin and terminate a string. You must choose either single-quote or double-quote.|
|`sortProperties`|`false`|`false` for doing nothing about the CSS property order. `alphabetical` for sorting CSS properties from A to Z. `grouped` for sorting CSS properties according to *[Stylint](https://github.com/SimenB/stylint/blob/master/src/data/ordering.json)*.|
|`alwaysUseImport`|`false`|`true` for always using *@import* over *@require*. The difference between *@import* and *@require* is very subtle. Please refer to [the offical guide](http://stylus-lang.com/docs/import.html#require).|
|`alwaysUseNot`|`false`|`true` for always using *not* keyword over *!* operator, otherwise `false`.|

## Writing the formatted output to a file

Normally, running the command will print out the formatted content to the output stream (console). However, you may write the formatted content to a file (or many files, if the pattern matches more than one files) by specifying `--outDir` or `-o`, and followed by the path to an output directory.
```
node stylus-supremacy ./path/to/your/file.styl --outDir ./path/to/output/directory
```

Alternatively, you may overwrite the original file with the formatted output by specifying `--replace` or `-r` parameter.
```
node stylus-supremacy ./path/to/your/file.styl --replace
```

Note that `--outDir` and `--replace` will not work together. You have to choose just one.

## Using this as an NPM module

Simply include *stylus-supremacy/edge/format* and call it with *Stylus* content as a string and formatting options as an object (see above topic).
```
const format = require('stylus-supremacy/edge/format')

const stylus = `
body
  display none
`

const options = {
  insertColons: true,
  insertSemicolons: true,
  insertBraces: true
}

console.log(format(stylus, options))
```

The stream output prints:
```
body {
  display: none;
}
```