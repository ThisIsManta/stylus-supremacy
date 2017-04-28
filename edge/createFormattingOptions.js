const _ = require('lodash')

const schema = {
	insertColons: {
		description: 'Insert or remove a colon between a property name and its value.',
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
		description: 'Insert or remove a semi-colon after a property value, a variable declaration, a variable assignment and a mixin/function call.',
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
		description: 'Insert or remove a pair of curly braces where they are supposed to be. Note that this option does not affect <code>@block</code> construction, see <a class="nada" href="#option-always-use-at-block"><mark>alwaysUseAtBlock</mark></a>.',
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
	insertNewLineAroundImports: {
		description: 'Insert a new-line around a group of <code>@import</code>/<code>@require</code>(s).\nOnly apply to imports outside a block when set to <code>"root"</code>, or only apply to imports inside a block when set to <code>"nested"</code>.\n<span class="no-vsce">Check the detailed examples <a href="#option-insert-newline-around-any">below</a>.</span>',
		oneOf: [true, false, 'root', 'nested'],
		default: true,
	},
	insertNewLineAroundBlocks: {
		description: 'Insert a new-line around blocks.\nOnly apply to top-level blocks when set to <code>"root"</code>, or only apply to nested blocks when set to <code>"nested"</code>.\n<span class="no-vsce">Check the detailed examples <a href="#option-insert-newline-around-any">below</a>.</span>',
		oneOf: [true, false, 'root', 'nested'],
		default: true,
	},
	insertNewLineAroundProperties: {
		description: 'Insert a new-line around a group of CSS properties.\nUnlike <mark>insertNewLineAroundBlocks</mark> and <mark>insertNewLineAroundOthers</mark>, this option cannot be set to <code>"root"</code> nor <code>"nested"</code> because CSS properties cannot be placed at the top level.\n<span class="no-vsce">Check the detailed examples <a href="#option-insert-newline-around-any">below</a>.</span>',
		oneOf: [true, false],
		default: false,
	},
	insertNewLineAroundOthers: {
		description: 'Insert a new-line around a group of non-properties, non-imports and non-blocks.\nOnly apply to others outside a block when set to <code>"root"</code>, or only apply to others inside a block when set to <code>"nested"</code>.\n<span class="no-vsce">Check the detailed examples <a href="#option-insert-newline-around-any">below</a>.</span>',
		oneOf: [true, false, 'root', 'nested'],
		default: false,
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
		description: 'Insert or remove a pair of parentheses around <code>if</code>-condition.',
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
		description: 'Represent an indentation. You may change this to any sequence of white-spaces.',
		type: 'string',
		default: '\t',
		hideInDemo: true,
		hideInVSCE: true,
	},
	newLineChar: {
		description: 'Represent a new-line character. You may want to change this to <code>"\\r\\n"</code> for Microsoft Windows.',
		oneOf: ['\n', '\r\n'],
		default: '\n',
		hideInDemo: true,
		hideInVSCE: true,
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
		description: 'Can be either <code>false</code> for doing nothing, <code>"alphabetical"</code> for sorting CSS properties from A to Z, <code>"grouped"</code> for sorting CSS properties according to <a href="https://github.com/SimenB/stylint/blob/master/src/data/ordering.json">Stylint</a>, or an array of property names that defines the property order (for example, <code>["color", "background", "display"]</code>).',
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
		description: 'Replace <code>!</code> operator with <code>not</code> keyword, or vice versa.',
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
		description: 'Replace an increased-indent at-block construction with an explicit one with <code>@block</code> keyword or vice versa.\nNote that this option does not incorporate <a class="nada" href="#option-insert-braces"><mark>insertBraces</mark></a> option.',
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
		description: 'Convert <code>@extend</code> keyword to <code>@extends</code> keyword, or vice versa.',
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
		description: 'Replace <code>0px</code>, <code>0%</code>, <code>0em</code> and so on with <code>0</code> without units, or do nothing.',
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
		description: 'Reduce <code>margin</code> and <code>padding</code> duplicate values by converting <code>margin x x x x</code> to <code>margin x</code>, <code>margin x y x y</code> to <code>margin x y</code>, and <code>margin x y y y</code> to <code>margin x y y</code> where <code>x</code>, <code>y</code> is a property value.',
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
				throw new Error(ex.message + ` at "${name}".`)
			}
			return hash
		}, {})
	}
}

function verify(data, info) {
	if (info.oneOf !== undefined) {
		const matchAnyValue = info.oneOf.some(item => {
			if (_.isObject(item)) {
				try {
					return verify(data, item)
				} catch (ex) {
					return false
				}
			} else {
				return item === data
			}
		})
		if (matchAnyValue === false) {
			throw new Error(`Expected ${data} to be one of the defined values`)
		}

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