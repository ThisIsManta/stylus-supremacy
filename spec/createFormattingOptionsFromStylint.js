const createFormattingOptions = require('../edge/createFormattingOptionsFromStylint')

const defaultStylintOptions = require('stylint/src/core/config')

describe('createFormattingOptionsFromStylint', () => {
	it('returns the default formatting options', () => {
		const formattingOptions = {
			insertBraces: false,
			insertColons: true,
			insertSpaceAfterComma: true,
			insertSpaceAfterComment: true,
			reduceMarginAndPaddingValues: true,
			alwaysUseExtends: false,
			insertLeadingZeroBeforeFraction: false,
			insertSemicolons: false,
			sortProperties: 'alphabetical',
			alwaysUseNoneOverZero: false,
			alwaysUseZeroWithoutUnit: true,
		}

		expect(createFormattingOptions(defaultStylintOptions)).toEqual(formattingOptions)
	})

	it('returns the correct value for for "always", "never" and false', () => {
		expect(createFormattingOptions({ colons: 'always' })).toEqual(jasmine.objectContaining({ insertColons: true }))
		expect(createFormattingOptions({ colons: 'never' })).toEqual(jasmine.objectContaining({ insertColons: false }))
		expect(createFormattingOptions({ colons: false }).insertColons).toBeUndefined()
	})

	it('returns the correct value for `alwaysUseExtends`', () => {
		expect(createFormattingOptions({ extendPref: '@extends' })).toEqual(jasmine.objectContaining({ alwaysUseExtends: true }))
		expect(createFormattingOptions({ extendPref: '@extend' })).toEqual(jasmine.objectContaining({ alwaysUseExtends: false }))
	})

	it('returns the correct value for `tabStopChar`', () => {
		expect(createFormattingOptions({ indentPref: 1 })).toEqual(jasmine.objectContaining({ tabStopChar: ' ' }))
		expect(createFormattingOptions({ indentPref: 2 })).toEqual(jasmine.objectContaining({ tabStopChar: '  ' }))
		expect(createFormattingOptions({ indentPref: false }).tabStopChar).toBeUndefined()
	})

	it('returns the correct value for `quoteChar`', () => {
		expect(createFormattingOptions({ quotePref: 'single' })).toEqual(jasmine.objectContaining({ quoteChar: '\'' }))
		expect(createFormattingOptions({ quotePref: 'double' })).toEqual(jasmine.objectContaining({ quoteChar: '"' }))
		expect(createFormattingOptions({ quotePref: false }).quoteChar).toBeUndefined()
	})

	it('returns the correct value for `sortProperties`', () => {
		expect(createFormattingOptions({ sortOrder: 'alphabetical' })).toEqual(jasmine.objectContaining({ sortProperties: 'alphabetical' }))
		expect(createFormattingOptions({ sortOrder: 'grouped' })).toEqual(jasmine.objectContaining({ sortProperties: 'grouped', insertNewLineAroundProperties: true }))
		expect(createFormattingOptions({ sortOrder: false })).toEqual(jasmine.objectContaining({ sortProperties: false }))
		expect(createFormattingOptions({ sortOrder: ['a', 'b', 'c'] })).toEqual(jasmine.objectContaining({ sortProperties: ['a', 'b', 'c'] }))
	})

	it('returns the correct value for `zeroUnits`', () => {
		expect(createFormattingOptions({ zeroUnits: 'always' })).toEqual(jasmine.objectContaining({ alwaysUseZeroWithoutUnit: false }))
		expect(createFormattingOptions({ zeroUnits: 'never' })).toEqual(jasmine.objectContaining({ alwaysUseZeroWithoutUnit: true }))
	})
})
