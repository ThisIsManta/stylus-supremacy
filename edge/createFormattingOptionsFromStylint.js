const _ = require('lodash')

const createAdapterForAlwaysNeverFalse = name => value => (value === 'always' || value === 'never') ? [name, value === 'always'] : []

const stylintOptionMap = {
	'blocks': createAdapterForAlwaysNeverFalse('alwaysUseAtBlock'),
	'brackets': createAdapterForAlwaysNeverFalse('insertBraces'),
	'colons': createAdapterForAlwaysNeverFalse('insertColons'),
	'commaSpace': createAdapterForAlwaysNeverFalse('insertSpaceAfterComma'),
	'commentSpace': createAdapterForAlwaysNeverFalse('insertSpaceAfterComment'),
	'efficient': createAdapterForAlwaysNeverFalse('reduceMarginAndPaddingValues'),
	'extendPref': value => ['alwaysUseExtends', value === '@extends'],
	'indentPref': value => value > 0 ? ['tabStopChar', _.repeat(' ', value)] : [],
	'leadingZero': createAdapterForAlwaysNeverFalse('insertLeadingZeroBeforeFraction'),
	'parenSpace': createAdapterForAlwaysNeverFalse('insertSpaceInsideParenthesis'),
	'quotePref': value => value === 'single' && ['quoteChar', '\''] || value === 'double' && ['quoteChar', '"'], // the values "single" and "double" will be converted to "'" and "\"" respectively.
	'semicolons': createAdapterForAlwaysNeverFalse('insertSemicolons'),
	'sortOrder': value => ['sortProperties', value],
	'zeroUnits': value => value === false ? [] : ['alwaysUseZeroWithoutUnit', value === 'never'], // unlike other options, the values "always" and "never" will be converted to false and true respectively.
}

function createFormattingOptionsFromStylint(stylintOptions = {}) {
	return _.chain(stylintOptions)
		.omitBy((item, name) => stylintOptionMap[name] === undefined)
		.reduce((temp, item, name) => {
			const value = _.isObject(item) && item.expect !== undefined ? item.expect : item

			const options = _.chunk(stylintOptionMap[name](value) || [], 2)
			options.forEach(pair => {
				if (pair[1] !== undefined) {
					temp[pair[0]] = pair[1]
				}
			})

			return temp
		}, {})
		.value()
}

module.exports = createFormattingOptionsFromStylint