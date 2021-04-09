const Stylus = require('stylus')

// recursively find if node is a Member or has child Member instance
function hasMember(node) {
	if (node instanceof Stylus.nodes.Member) {
		return true
	} else if (node instanceof Stylus.nodes.Expression) {
		return node.nodes.some(hasMember)
	} else if (node instanceof Stylus.nodes.Call) {
		return node.args.nodes.some(hasMember)
	}
}

module.exports = hasMember
