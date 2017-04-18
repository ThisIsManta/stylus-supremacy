const createFormattingOptions = require('../edge/createFormattingOptionsFromStylintOptions')

const defaultStylintOptions = require('stylint/src/core/config')

describe('createFormattingOptionsFromStylintOptions', () => {
	it('represents the default formatting options', () => {
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
			alwaysUseZeroWithoutUnit: true,
		}

		expect(createFormattingOptions(defaultStylintOptions)).toEqual(formattingOptions)
	})

	it('returns the correct value for for "always", "never" and false', () => {
		expect(createFormattingOptions({ colons: 'always' }).insertColons).toBe(true)
		expect(createFormattingOptions({ colons: 'never' }).insertColons).toBe(false)
		expect(createFormattingOptions({ colons: false }).insertColons).toBeUndefined()
	})

	it('returns the correct value for `alwaysUseExtends`', () => {
		expect(createFormattingOptions({ extendPref: '@extends' }).alwaysUseExtends).toBe(true)
		expect(createFormattingOptions({ extendPref: '@extend' }).alwaysUseExtends).toBe(false)
	})

	it('returns the correct value for `tabStopChar`', () => {
		expect(createFormattingOptions({ indentPref: 1 }).tabStopChar).toBe(' ')
		expect(createFormattingOptions({ indentPref: 2 }).tabStopChar).toBe('  ')
		expect(createFormattingOptions({ indentPref: false }).tabStopChar).toBeUndefined()
	})

	it('returns the correct value for `quoteChar`', () => {
		expect(createFormattingOptions({ quotePref: 'single' }).quoteChar).toBe('\'')
		expect(createFormattingOptions({ quotePref: 'double' }).quoteChar).toBe('"')
		expect(createFormattingOptions({ quotePref: false }).quoteChar).toBeUndefined()
	})

	it('returns the correct value for `sortProperties`', () => {
		expect(createFormattingOptions({ sortOrder: 'alphabetical' }).sortProperties).toBe('alphabetical')
		expect(createFormattingOptions({ sortOrder: 'grouped' }).sortProperties).toBe('grouped')
		expect(createFormattingOptions({ sortOrder: ['a', 'b', 'c'] }).sortProperties).toEqual(['a', 'b', 'c'])
		expect(createFormattingOptions({ sortOrder: false }).sortProperties).toBe(false)
	})

	it('returns the correct value for `zeroUnits`', () => {
		expect(createFormattingOptions({ zeroUnits: 'always' }).alwaysUseZeroWithoutUnit).toBe(false)
		expect(createFormattingOptions({ zeroUnits: 'never' }).alwaysUseZeroWithoutUnit).toBe(true)
	})
})
