const isObject = require('lodash/isObject')
const isInteger = require('lodash/isInteger')
const uniq = require('lodash/uniq')

const schema = require('./schema')

function createFormattingOptions(options = {}) {
	const hash = {}
	for (const name in schema) {
		try {
			// Support "stylusSupremacy." prefix for Visual Studio Code setting compatibility since v2.4
			const normalProjection = options[name]
			const prefixProjection = options['stylusSupremacy.' + name]
			const data = prefixProjection !== undefined ? prefixProjection : normalProjection

			if (data === undefined) {
				hash[name] = schema[name].default

			} else if (verify(data, schema[name])) {
				hash[name] = data
			}
		} catch (ex) {
			throw new Error(ex.message + ` at "${name}".`)
		}
	}
	return hash
}

function verify(data, info) {
	if (Array.isArray(info.enum)) {
		return info.enum.some(item => {
			if (isObject(item)) {
				return verify(data, item)
			} else {
				return data === item
			}
		})

	} else if (info.oneOf !== undefined) {
		const matchAnyValue = info.oneOf.some(item => {
			if (isObject(item)) {
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
		if (isInteger(data) === false) {
			throw new Error(`Expected ${data} to be an integer`)
		} else if (info.minimum !== undefined && data < info.minimum) {
			throw new Error(`Expected ${data} to be greater or equal than ${info.minimum}`)
		} else if (info.maximum !== undefined && data > info.maximum) {
			throw new Error(`Expected ${data} to be less or equal than ${info.maximum}`)
		}

	} else if (info.type === 'array') {
		if (Array.isArray(data) === false) {
			throw new Error(`Expected ${data} to be an array`)
		} else if (info.items !== undefined && data.some(item => verify(item, info.items) === false)) {
			throw new Error(`Expected ${data} to have items of ${JSON.stringify(info.items)}`)
		} else if (info.uniqueItems === true && data.length !== uniq(data).length) {
			throw new Error(`Expected ${data} to have unique items`)
		}

	} else if (info.type === 'null') {
		if (data !== null) {
			throw new Error(`Expected ${data} to be null`)
		}

	} else if (info.type !== typeof data) { // 'boolean', 'string', 'number', 'object'
		throw new Error(`Expected ${data} to be ${info.type}`)
	}

	return true
}

module.exports = createFormattingOptions