const _ = require('lodash')

const createAdapterForAlwaysNeverFalse = value => (value === 'always' || value === 'never') ? value === 'always' : undefined

const stylintOptionMap = {
	blocks: ['alwaysUseAtBlock', createAdapterForAlwaysNeverFalse],
	brackets: ['insertBraces', createAdapterForAlwaysNeverFalse],
	colons: ['insertColons', createAdapterForAlwaysNeverFalse],
	commaSpace: ['insertSpaceAfterComma', createAdapterForAlwaysNeverFalse],
	commentSpace: ['insertSpaceAfterComment', createAdapterForAlwaysNeverFalse],
	efficient: ['reduceMarginAndPaddingValues', createAdapterForAlwaysNeverFalse],
	extendPref: ['alwaysUseExtends', value => value === '@extends'],
	indentPref: ['tabStopChar', value => value > 0 ? _.repeat(' ', value) : undefined],
	leadingZero: ['insertLeadingZeroBeforeFraction', createAdapterForAlwaysNeverFalse],
	parenSpace: ['insertSpaceInsideParenthesis', createAdapterForAlwaysNeverFalse],
	quotePref: ['quoteChar', value => (value === 'single' && '\'' || value === 'double' && '"' || undefined)],
	semicolons: ['insertSemicolons', createAdapterForAlwaysNeverFalse],
	sortOrder: ['sortProperties', value => value, 'insertNewLineAroundProperties', value => value === 'grouped' ? true : undefined],
	none: ['alwaysUseNoneOverZero', createAdapterForAlwaysNeverFalse],
	zeroUnits: ['alwaysUseZeroWithoutUnit', value => value === false ? undefined : value === 'never'],
}

function createFormattingOptionsFromStylint(stylintOptions = {}) {
	return _.chain(stylintOptions)
		.omitBy((item, name) => stylintOptionMap[name] === undefined)
		.reduce((temp, rule, name) => {
			const value = _.isObject(rule) && rule.expect !== undefined ? rule.expect : rule

			_.chunk(stylintOptionMap[name] || [], 2).forEach(pair => {
				const result = pair[1](value)
				if (result !== undefined) {
					temp[pair[0]] = result
				}
			})

			return temp
		}, {})
		.value()
}

createFormattingOptionsFromStylint.map = stylintOptionMap

module.exports = createFormattingOptionsFromStylint