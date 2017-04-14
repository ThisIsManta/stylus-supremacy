const StylintAdapter = require('../edge/StylintAdapter')

const defaultStylintOptions = require('stylint/src/core/config')

describe('StylintAdapter', () => {
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
			alwaysUseZeroWithoutUnit: false,
		}

		expect(new StylintAdapter(defaultStylintOptions).toJSON()).toEqual(formattingOptions)
	})

	it('returns the correct value for for "always", "never" and false', () => {
		expect(new StylintAdapter({ colons: 'always' }).insertColons).toBe(true)
		expect(new StylintAdapter({ colons: 'never' }).insertColons).toBe(false)
		expect(new StylintAdapter({ colons: false }).insertColons).toBeUndefined()
	})

	it('returns the correct value for `alwaysUseExtends`', () => {
		expect(new StylintAdapter({ extendPref: '@extends' }).alwaysUseExtends).toBe(true)
		expect(new StylintAdapter({ extendPref: '@extend' }).alwaysUseExtends).toBe(false)
	})

	it('returns the correct value for `tabStopChar`', () => {
		expect(new StylintAdapter({ indentPref: 1 }).tabStopChar).toBe(' ')
		expect(new StylintAdapter({ indentPref: 2 }).tabStopChar).toBe('  ')
		expect(new StylintAdapter({ indentPref: false }).tabStopChar).toBeUndefined()
	})

	it('returns the correct value for `quoteChar`', () => {
		expect(new StylintAdapter({ quotePref: 'single' }).quoteChar).toBe('\'')
		expect(new StylintAdapter({ quotePref: 'double' }).quoteChar).toBe('"')
		expect(new StylintAdapter({ quotePref: false }).quoteChar).toBeUndefined()
	})

	it('returns the correct value for `sortProperties`', () => {
		expect(new StylintAdapter({ sortOrder: 'alphabetical' }).sortProperties).toBe('alphabetical')
		expect(new StylintAdapter({ sortOrder: 'grouped' }).sortProperties).toBe('grouped')
		expect(new StylintAdapter({ sortOrder: ['a', 'b', 'c'] }).sortProperties).toEqual(['a', 'b', 'c'])
		expect(new StylintAdapter({ sortOrder: false }).sortProperties).toBe(false)
	})
})
