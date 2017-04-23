const _ = require('lodash')

const schema = {
	insertColons: {
		description: 'Insert or remove a colon after a property name.',
		type: 'boolean',
		default: true,
		example: {
			values: [true, false],
			code: `
			.class1
				background red
			`
		}
	},
	insertSemicolons: {
		description: 'Insert or remove a semi-colon after a property value, a variable declaration, a variable assignment and a function call.',
		type: 'boolean',
		default: true,
		example: {
			values: [true, false],
			code: `
			.class1
				background red
			`
		}
	},
	insertBraces: {
		description: 'Insert or remove a pair of curly braces between a selector body, a mixin body and a function body. Note that this option does not affect <code>@block</code> construction, see alwaysUseAtBlock.',
		type: 'boolean',
		default: true,
		example: {
			values: [true, false],
			code: `
			.class1
				background red
			`
		}
	},
	insertNewLineBetweenGroups: {
		description: 'Represent a number of new-line between different type of groups.',
		type: 'integer',
		minimum: 0,
		default: 1,
		example: {
			values: [0, 1],
			code: `
			.class1
				$gray = #EEE
				background red
				color $gray
				mixin1()
				mixin2()
			.class2
				background blue
			`
		}
	},
	insertNewLineBetweenSelectors: {
		description: 'Insert or remove a new-line between selectors.',
		type: 'boolean',
		default: false,
		example: {
			values: [true, false],
			code: `
			.class1, .class2
				background red
			`
		}
	},
	insertSpaceBeforeComment: {
		description: 'Insert or remove a white-space before a comment.',
		type: 'boolean',
		default: true,
		example: {
			values: [true, false],
			code: `
			.class1
				background red//comment
			`
		}
	},
	insertSpaceAfterComment: {
		description: 'Insert or remove a white-space after a comment.',
		type: 'boolean',
		default: true,
		example: {
			values: [true, false],
			code: `
			.class1
				background red//comment
			`
		}
	},
	insertSpaceAfterComma: {
		description: 'Insert or remove a white-space after a comma.',
		type: 'boolean',
		default: true,
		example: {
			values: [true, false],
			code: `
			mixin(a,b)
				margin a b
			`
		}
	},
	insertSpaceInsideParenthesis: {
		description: 'Insert or remove a white-space after an open parenthesis and before a close parenthesis.',
		type: 'boolean',
		default: false,
		example: {
			values: [true, false],
			code: `
			mixin(a,b)
				margin a b
			`
		}
	},
	insertParenthesisAroundIfCondition: {
		description: 'Insert or remove a pair of parentheses between *if*-condition.',
		type: 'boolean',
		default: true,
		example: {
			values: [true, false],
			code: `
			if (a > b)
				background red
			`
		}
	},
	insertNewLineBeforeElse: {
		description: 'Insert or remove a new-line before <code>else</code> keyword.',
		type: 'boolean',
		default: false,
		example: {
			values: [true, false],
			code: `
			if (a > b)
				background red
			else
				background blue
			`
		}
	},
	insertLeadingZeroBeforeFraction: {
		description: 'Insert or remove a zero before a number that between 1 and 0.',
		type: 'boolean',
		default: true,
		example: {
			values: [true, false],
			code: `
			.class1
				margin 0.5px
			`
		}
	},
	tabStopChar: {
		description: 'Represent a tab-stop character. You may change this to double white-space sequence or anything.',
		type: 'string',
		default: '\t'
	},
	newLineChar: {
		description: 'Represent a new-line character. You may change this to `\"\\r\\n\"` for *Microsoft Windows*.',
		oneOf: ['\n', '\r\n'],
		default: '\n'
	},
	quoteChar: {
		description: 'Represent a quote character that is used to begin and terminate a string. You must choose either a single-quote or a double-quote.',
		oneOf: ['\'', '"'],
		default: '\'',
		example: {
			values: ['\'', '"'],
			code: `
			.class1
				font-family 'Open Sans'
			`
		}
	},
	sortProperties: {
		description: 'Can be either <code>false</code> for doing nothing about the CSS property order, <code>"alphabetical"</code> for sorting CSS properties from A to Z, <code>"grouped"</code> for sorting CSS properties according to <a href="https://github.com/SimenB/stylint/blob/master/src/data/ordering.json">Stylint</a>, or an array of property names that defines the property order (for example, <code>["color", "background", "display"]</code>).',
		oneOf: [
			false,
			'alphabetical',
			'grouped',
			{
				type: 'array',
				items: { type: 'string' },
				uniqueItems: true
			}
		],
		default: false,
		example: {
			values: [false, 'alphabetical', 'grouped', ['color', 'background', 'display']],
			code: `
			.class1
				background red
				display block
				color white
			`
		}
	},
	alwaysUseImport: {
		description: 'Replace <code>@require</code> with <code>@import</code>, or do nothing.',
		type: 'boolean',
		default: false,
		example: {
			values: [true, false],
			code: `
			@require './file.styl'
			`
		}
	},
	alwaysUseNot: {
		description: 'Replace <code>!</code> operator with <code>not</code> keyword or vice versa.',
		type: 'boolean',
		default: false,
		example: {
			values: [true, false],
			code: `
			.class1
				if (!condition)
					background red
			`
		}
	},
	alwaysUseAtBlock: {
		description: 'Replace an increased-indent at-block construction with an explicit one with <code>@block</code> keyword or vice versa.\nNote that this option does not incorporate <mark>insertBraces</mark> option.',
		type: 'boolean',
		default: false,
		example: {
			values: [true, false],
			code: `
			block =
				background red
			`
		}
	},
	alwaysUseExtends: {
		description: 'Convert <code>@extend</code> keyword to <code>@extends</code> keyword or vice versa.',
		type: 'boolean',
		default: false,
		example: {
			values: [true, false],
			code: `
			.class1
				background red
			.class2
				@extend .class1
				color white
			`
		}
	},
	alwaysUseZeroWithoutUnit: {
		description: 'Replace <code>0px</code>, <code>0%</code>, <code>0em</code> and so on with <code>0</code> without units or vice versa.',
		type: 'boolean',
		default: false,
		example: {
			values: [true, false],
			code: `
			.class1
				margin 0px
			`
		}
	},
	reduceMarginAndPaddingValues: {
		description: 'Reduce <code>margin</code> and <code>padding</code> duplicate values by converting <code>margin x</code> to <code>margin x x x x</code>, <code>margin x y</code> to <code>margin x y x y</code> where <code>x</code>, <code>y</code> is a property value.',
		type: 'boolean',
		default: false,
		example: {
			values: [true, false],
			code: `
			.class1
				margin 0px 0px
				padding 0px 5px 0px 5px
			`
		}
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
			try {
				if (options[name] === undefined) {
					hash[name] = info.default

				} else if (verify(options[name], info)) {
					hash[name] = options[name]
				}
			} catch (ex) {
				ex.message += ` at "${name}".` 
				throw ex
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
		} else if (info.minimum !== undefined && data < info.minimum) {
			throw new Error(`Expected ${data} to be greater or equal than ${info.minimum}`)
		} else if (info.maximum !== undefined && data > info.maximum) {
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

createFormattingOptions.schema = schema

module.exports = createFormattingOptions