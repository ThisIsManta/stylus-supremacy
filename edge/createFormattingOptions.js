const _ = require('lodash')

const schema = {
	insertColons: {
		/**
		 * .class1 {
		 *   background: red
		 * }
		 */
		description: 'Insert or remove a colon after a property name.',
		type: 'boolean',
		default: true
	},
	insertSemicolons: {
		description: 'Insert or remove a semi-colon after a property value, a variable declaration, a variable assignment and a function call.',
		type: 'boolean',
		default: true
	},
	insertBraces: {
		description: 'Insert or remove a pair of curly braces between a selector body, a mixin body and a function body. Note that this option does not affect *@block* construction, see alwaysUseAtBlock.',
		type: 'boolean',
		default: true
	},
	insertNewLineBetweenGroups: {
		description: 'Represent a number of new-line between different type of groups.',
		type: 'integer',
		minimum: 0,
		default: 1
	},
	insertNewLineBetweenSelectors: {
		description: 'Insert or remove a new-line between selectors.',
		type: 'boolean',
		default: false
	},
	insertSpaceBeforeComment: {
		description: 'Insert or remove a white-space before a comment.',
		type: 'boolean',
		default: true
	},
	insertSpaceAfterComment: {
		description: 'Insert or remove a white-space after a comment.',
		type: 'boolean',
		default: true
	},
	insertSpaceAfterComma: {
		description: 'Insert or remove a white-space after a comma.',
		type: 'boolean',
		default: true
	},
	insertSpaceInsideParenthesis: {
		description: 'Insert or remove a white-space after an open parenthesis and before a close parenthesis.',
		type: 'boolean',
		default: false
	},
	insertParenthesisAroundIfCondition: {
		description: 'Insert or remove a pair of parentheses between *if*-condition.',
		type: 'boolean',
		default: true
	},
	insertNewLineBeforeElse: {
		description: 'Insert or remove a new-line before *else* keyword.',
		type: 'boolean',
		default: false
	},
	insertLeadingZeroBeforeFraction: {
		description: 'Insert or remove a zero before a number that between 1 and 0.',
		type: 'boolean',
		default: true
	},
	tabStopChar: {
		description: 'Represent a tab-stop character. You may change this to double white-space sequence or anything.',
		type: 'string',
		default: '\t'
	},
	newLineChar: {
		description: 'Represent a new-line character. You may change this to `\"\\r\\n\"` for *Microsoft Windows*.',
		oneOf: [
			'\n',
			'\r\n'
		],
		default: '\n'
	},
	quoteChar: {
		description: 'Represent a quote character that is used to begin and terminate a string. You must choose either single-quote or double-quote.',
		oneOf: [
			'\'',
			'"'
		],
		default: '\''
	},
	sortProperties: {
		description: 'Can be either \n`false` for doing nothing about the CSS property order, \n\"alphabetical\" for sorting CSS properties from A to Z, \n\"grouped\" for sorting CSS properties according to https://github.com/SimenB/stylint/blob/master/src/data/ordering.json, \nor an array of property names that defines the property order (for example, [\"display\", \"margin\", \"padding\"]).',
		oneOf: [
			false,
			'alphabetical',
			'grouped',
			{
				type: 'array',
				items: {
					type: 'string'
				},
				uniqueItems: true
			}
		],
		default: false
	},
	alwaysUseImport: {
		description: 'Convert *@require* to *@import*.',
		type: 'boolean',
		default: false
	},
	alwaysUseNot: {
		description: 'Convert *!* operator to *not* keyword or vice versa.',
		type: 'boolean',
		default: false
	},
	alwaysUseAtBlock: {
		description: 'Convert an increased-indent at-block construction to an explicit one with *@block* keyword or vice versa. Note that this option ignores **`insertBraces`** option.',
		type: 'boolean',
		default: false
	},
	alwaysUseExtends: {
		description: 'Convert *@extend* keyword to *@extends* keyword or vice versa.',
		type: 'boolean',
		default: false
	},
	alwaysUseZeroWithoutUnit: {
		description: 'Convert `0px`, `0%`, `0em` and so on to `0` without units or vice versa.',
		type: 'boolean',
		default: false
	},
	reduceMarginAndPaddingValues: {
		description: 'Reduce `margin` and `padding` duplicate values by converting `margin x` to `margin x x x x`, `margin x y` to `margin x y x y` where `x`, `y` is a property value.',
		type: 'boolean',
		default: false
	}
}

function createFormattingOptions(options = {}) {
	if (_.isEmpty(options)) {
		return _.reduce(schema, (hash, info, name) => {
			hash[name] = info.default
			return hash
		}, {})

	} else {
		return _.reduce(schema, (hash, info, name) => {
			if (options[name] === undefined) {
				hash[name] = info.default

			} else if (verify(options[name], info)) {
				hash[name] = options[name]
			}
			return hash
		}, {})
	}
}

function verify(data, info) {
	if (info.oneOf !== undefined) {
		info.oneOf.some(item => _.isObject(item) ? verify(data, item) : (item === data))

	} else if (info.type === 'integer') {
		if (_.isInteger(data) === false) {
			throw new Error(`Expected ${data} to be an integer`)
		} else if (info.minimum !== undefined && data <= info.minimum) {
			throw new Error(`Expected ${data} to be greater or equal than ${info.minimum}`)
		} else if (info.maximum !== undefined && data >= info.maximum) {
			throw new Error(`Expected ${data} to be less or equal than ${info.maximum}`)
		}

	} else if (info.type === 'array') {
		if (_.isArray(data) === false) {
			throw new Error(`Expected ${data} to be an array`)
		} else if (info.items !== undefined && _.some(data, item => verify(item, info.items) === false)) {
			throw new Error(`Expected ${data} to have items of ${JSON.stringify(info.items)}`)
		} else if (info.uniqueItems === true && _.size(data) !== _.uniq(data).length) {
			throw new Error(`Expected ${data} to have unique items`)
		}

	} else if (info.type === 'null') {
		if (data !== null) {
			throw new Error(`Expected ${data} to be null`)
		}

	} else if (info.type !== typeof data) {
		throw new Error(`Expected ${data} to be ${info.type}`)
	}

	return true
}

module.exports = createFormattingOptions