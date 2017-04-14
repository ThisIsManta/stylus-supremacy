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
	'indentPref': value => value > 0 && ['tabStopChar', _.repeat(' ', value)],
	'leadingZero': createAdapterForAlwaysNeverFalse('insertLeadingZeroBeforeFraction'),
	'parenSpace': createAdapterForAlwaysNeverFalse('insertSpaceInsideParenthesis'),
	'quotePref': value => value === 'single' && ['quoteChar', '\''] || value === 'double' && ['quoteChar', '"'],
	'semicolons': createAdapterForAlwaysNeverFalse('insertSemicolons'),
	'sortOrder': value => ['sortProperties', value],
	'zeroUnits': createAdapterForAlwaysNeverFalse('alwaysUseZeroWithoutUnit'),
}

class StylintAdapter {
	constructor(stylintOptions = {}) {
		_.chain(stylintOptions)
			.omitBy((item, name) => stylintOptionMap[name] === undefined)
			.forEach((item, name) => {
				const value = _.isObject(item) && item.expect !== undefined ? item.expect : item

				const options = _.chunk(stylintOptionMap[name](value) || [], 2)
				options.forEach(option => {
					this[option[0]] = option[1]
				})
			})
			.value()
	}

	toJSON() {
		return _.chain(Object.getOwnPropertyNames(this))
			.filter(name => this[name] !== undefined)
			.map(name => [name, this[name]])
			.fromPairs()
			.value()
	}
}

module.exports = StylintAdapter