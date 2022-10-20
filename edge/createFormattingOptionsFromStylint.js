const isObject = require('lodash/isObject')
const difference = require('lodash/difference')
const chunk = require('lodash/chunk')
const identity = require('lodash/identity')

const schema = require('./schema')

const createAdapterForAlwaysNeverFalse = value => (value === 'always' || value === 'never') ? value === 'always' : undefined

const stylintOptionMap = {
	blocks: ['alwaysUseAtBlock', createAdapterForAlwaysNeverFalse],
	brackets: ['insertBraces', createAdapterForAlwaysNeverFalse],
	colons: ['insertColons', createAdapterForAlwaysNeverFalse],
	commaSpace: ['insertSpaceAfterComma', createAdapterForAlwaysNeverFalse],
	commentSpace: ['insertSpaceAfterComment', createAdapterForAlwaysNeverFalse],
	efficient: ['reduceMarginAndPaddingValues', createAdapterForAlwaysNeverFalse],
	exclude: ['ignoreFiles', value => value],
	extendPref: ['alwaysUseExtends', value => value === '@extends'],
	indentPref: ['tabStopChar', value => value > 0 ? ' '.repeat(value) : undefined],
	leadingZero: ['insertLeadingZeroBeforeFraction', createAdapterForAlwaysNeverFalse],
	parenSpace: ['insertSpaceInsideParenthesis', createAdapterForAlwaysNeverFalse],
	quotePref: ['quoteChar', value => (value === 'single' && '\'' || value === 'double' && '"' || undefined)],
	semicolons: ['insertSemicolons', createAdapterForAlwaysNeverFalse],
	sortOrder: ['sortProperties', value => value, 'insertNewLineAroundProperties', value => value === 'grouped' ? true : undefined],
	none: ['alwaysUseNoneOverZero', createAdapterForAlwaysNeverFalse],
	zeroUnits: ['alwaysUseZeroWithoutUnit', value => value === false ? undefined : value === 'never'],
}

const usedFormattingOptionNames = chunk(Object.values(stylintOptionMap).flat(), 2)
	.flatMap(([name]) => name)

// Prevent conflicts by removing the formatting options that can be specified via Stylint above
const complementaryOptionMap = Object.fromEntries(
	difference(Object.keys(schema), usedFormattingOptionNames)
		.map(name => ['stylusSupremacy.' + name, [name, identity]])
)

const universalOptionMap = {
	...stylintOptionMap,
	...complementaryOptionMap
}

function createFormattingOptionsFromStylint(stylintOptions = {}) {
	return Object.entries(stylintOptions)
		.filter(([name]) => universalOptionMap[name] !== undefined)
		.reduce((hash, [name, rule]) => {
			const value = isObject(rule) && rule.expect !== undefined ? rule.expect : rule

			chunk(universalOptionMap[name], 2).forEach(([name, convert]) => {
				const result = convert(value)
				if (result !== undefined) {
					hash['stylusSupremacy.' + name] = result
				}
			})

			return hash
		}, {})
}

createFormattingOptionsFromStylint.map = stylintOptionMap

module.exports = createFormattingOptionsFromStylint