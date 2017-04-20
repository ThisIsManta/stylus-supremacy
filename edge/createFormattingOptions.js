const _ = require('lodash')

const schema = require('./formattingOptionSchema.json')

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
				console.log('using', name, options[name])
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
		} else if (info.minimum !== undefined && data <= minimum) {
			throw new Error(`Expected ${data} to be greater or equal than ${minimum}`)
		} else if (info.maximum !== undefined && data <= maximum) {
			throw new Error(`Expected ${data} to be less or equal than ${maximum}`)
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