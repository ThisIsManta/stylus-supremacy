const createFormattingOptions = require('../edge/createFormattingOptionsFromStylint')

const defaultStylintOptions = require('stylint/src/core/config')

describe('createFormattingOptionsFromStylint', () => {
	it('returns the default formatting options', () => {
		const formattingOptions = {
			'stylusSupremacy.insertBraces': false,
			'stylusSupremacy.insertColons': true,
			'stylusSupremacy.insertSpaceAfterComma': true,
			'stylusSupremacy.insertSpaceAfterComment': true,
			'stylusSupremacy.reduceMarginAndPaddingValues': true,
			'stylusSupremacy.alwaysUseExtends': false,
			'stylusSupremacy.insertLeadingZeroBeforeFraction': false,
			'stylusSupremacy.insertSemicolons': false,
			'stylusSupremacy.sortProperties': 'alphabetical',
			'stylusSupremacy.alwaysUseNoneOverZero': false,
			'stylusSupremacy.alwaysUseZeroWithoutUnit': true,
		}

		expect(createFormattingOptions(defaultStylintOptions))
			.toEqual(formattingOptions)
	})

	it('returns the correct value for for "always", "never" and false', () => {
		expect(createFormattingOptions({ colons: 'always' }))
			.toEqual(jasmine.objectContaining({ 'stylusSupremacy.insertColons': true }))
		expect(createFormattingOptions({ colons: 'never' }))
			.toEqual(jasmine.objectContaining({ 'stylusSupremacy.insertColons': false }))
		expect(createFormattingOptions({ colons: false })['stylusSupremacy.insertColons'])
			.toBeUndefined()
	})

	it('returns the correct value for `alwaysUseExtends`', () => {
		expect(createFormattingOptions({ extendPref: '@extends' }))
			.toEqual(jasmine.objectContaining({ 'stylusSupremacy.alwaysUseExtends': true }))
		expect(createFormattingOptions({ extendPref: '@extend' }))
			.toEqual(jasmine.objectContaining({ 'stylusSupremacy.alwaysUseExtends': false }))
	})

	it('returns the correct value for `tabStopChar`', () => {
		expect(createFormattingOptions({ indentPref: 1 }))
			.toEqual(jasmine.objectContaining({ 'stylusSupremacy.tabStopChar': ' ' }))
		expect(createFormattingOptions({ indentPref: 2 }))
			.toEqual(jasmine.objectContaining({ 'stylusSupremacy.tabStopChar': '  ' }))
		expect(createFormattingOptions({ indentPref: false })['stylusSupremacy.tabStopChar'])
			.toBeUndefined()
	})

	it('returns the correct value for `quoteChar`', () => {
		expect(createFormattingOptions({ quotePref: 'single' }))
			.toEqual(jasmine.objectContaining({ 'stylusSupremacy.quoteChar': '\'' }))
		expect(createFormattingOptions({ quotePref: 'double' }))
			.toEqual(jasmine.objectContaining({ 'stylusSupremacy.quoteChar': '"' }))
		expect(createFormattingOptions({ quotePref: false })['stylusSupremacy.quoteChar'])
			.toBeUndefined()
	})

	it('returns the correct value for `sortProperties`', () => {
		expect(createFormattingOptions({ sortOrder: 'alphabetical' }))
			.toEqual(jasmine.objectContaining({ 'stylusSupremacy.sortProperties': 'alphabetical' }))
		expect(createFormattingOptions({ sortOrder: 'grouped' }))
			.toEqual(jasmine.objectContaining({ 'stylusSupremacy.sortProperties': 'grouped', 'stylusSupremacy.insertNewLineAroundProperties': true }))
		expect(createFormattingOptions({ sortOrder: false }))
			.toEqual(jasmine.objectContaining({ 'stylusSupremacy.sortProperties': false }))
		expect(createFormattingOptions({ sortOrder: ['a', 'b', 'c'] }))
			.toEqual(jasmine.objectContaining({ 'stylusSupremacy.sortProperties': ['a', 'b', 'c'] }))
	})

	it('returns the correct value for `zeroUnits`', () => {
		expect(createFormattingOptions({ zeroUnits: 'always' }))
			.toEqual(jasmine.objectContaining({ 'stylusSupremacy.alwaysUseZeroWithoutUnit': false }))
		expect(createFormattingOptions({ zeroUnits: 'never' }))
			.toEqual(jasmine.objectContaining({ 'stylusSupremacy.alwaysUseZeroWithoutUnit': true }))
	})

	it('returns the same value for `exclude`', () => {
		expect(createFormattingOptions({ exclude: ['test'] }))
			.toEqual(jasmine.objectContaining({ 'stylusSupremacy.ignoreFiles': ['test'] }))
	})

	it('returns the same value for a complementary formatting option', () => {
		expect(createFormattingOptions({ 'stylusSupremacy.selectorSeparator': '*' }))
			.toEqual(jasmine.objectContaining({ 'stylusSupremacy.selectorSeparator': '*' }))
	})

	it('returns the value from a Stylint rule rather than a conflicted formatting option', () => {
		expect(createFormattingOptions({ 'exclude': '#', 'stylusSupremacy.ignoreFiles': '*' }))
			.toEqual(jasmine.objectContaining({ 'stylusSupremacy.ignoreFiles': '#' }))
	})
})
