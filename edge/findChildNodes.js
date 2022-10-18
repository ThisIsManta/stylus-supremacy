const isObject = require('lodash/isObject')

function findChildNodes(inputNode, condition, results = [] /* Internal */, visited = [] /* Internal */) {
	if (inputNode && visited.includes(inputNode) === false) {
		// Remember the visited nodes to prevent stack overflow
		visited.push(inputNode)

		if (condition(inputNode)) {
			results.push(inputNode)
		}

		Object.getOwnPropertyNames(inputNode).forEach(name => {
			const prop = inputNode[name]
			if (Array.isArray(prop)) {
				prop.forEach(node => {
					findChildNodes(node, condition, results, visited)
				})
			} else if (isObject(prop)) {
				findChildNodes(prop, condition, results, visited)
			}
		})
	}
	return results
}

module.exports = findChildNodes