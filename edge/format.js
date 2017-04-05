const os = require('os')
const stylus = require('stylus')
const ordering = require('stylint/src/data/ordering.json')
const _ = require('lodash')

const defaultFormattingOptions = {
	insertColons: true,
	insertSemicolons: true,
	insertBraces: true,
	insertNewLineBetweenGroups: 1,
	insertNewLineBetweenSelectors: false,
	insertNewLineBetweenElseIf: false,
	insertSpaceBeforeComments: true,
	insertSpaceAfterComments: true,
	insertParenthesisAroundConditions: true,
	// TODO: insertLeadingZeroInFrontOfNumbers: true,
	indentChar: '\t',
	newLineChar: os.EOL,
	stringQuoteChar: '\'',
	// TODO: sortImports: 'alphabetical',
	sortProperties: 'alphabetical',
	alwaysUseImport: false,
	alwaysUseNot: false,
}

class StringBuffer {
	constructor() {
		this.buffer = []
	}

	append(text = '') {
		if (arguments.length > 1) {
			throw new Error('Found exceed arguments')

		} else if (_.isObject(text)) {
			throw new Error('Found a non-string argument')

		} else if (text !== '') {
			this.buffer.push(text)
		}

		return this
	}

	remove(text) {
		if (text === undefined) {
			this.buffer.pop()

		} else if (this.buffer.length > 0) {
			if (_.last(this.buffer) === text) {
				this.buffer.pop()

			} else if (_.last(this.buffer).endsWith(text)) {
				this.buffer[this.buffer.length - 1] = _.last(this.buffer).substring(0, _.last(this.buffer).length - text.length)
			}
		}

		return this
	}

	toString() {
		return this.buffer.join('')
	}
}

function format(content, options) {
	options = _.assign({}, defaultFormattingOptions, options)

	const warnings = []

	const lines = content.split('\n')

	const rootNode = new stylus.Parser(content).parse()

	function travel(parentNode, inputNode, indentLevel, insideExpression = false, data = {}) {
		// Check argument type
		if ([
			_.isObject(parentNode) || parentNode === null && inputNode instanceof stylus.nodes.Root,
			_.isObject(inputNode),
			_.isInteger(indentLevel) && indentLevel >= 0,
			_.isBoolean(insideExpression),
			_.isPlainObject(data),
		].some(constraint => !constraint)) {
			throw new Error('Found one or many invalid arguments.')
		}

		inputNode.parent = parentNode

		const outputBuffer = new StringBuffer()

		const indent = _.repeat(options.indentChar, indentLevel)

		// Insert sticky comment(s) before the current node
		if (inputNode.commentsOnTop) {
			outputBuffer.append(inputNode.commentsOnTop.map(node => travel(inputNode.parent, node, indentLevel)).join(''))
		}

		if (inputNode instanceof stylus.nodes.Import) {
			outputBuffer.append(indent)
			outputBuffer.append('@')
			outputBuffer.append(options.alwaysUseImport || inputNode.once === false ? 'import' : 'require')
			outputBuffer.append(' ')
			outputBuffer.append(travel(inputNode, inputNode.path, indentLevel, true))

			if (options.insertSemicolons) {
				outputBuffer.append(';')
			}
			outputBuffer.append(options.newLineChar)

		} else if (inputNode instanceof stylus.nodes.Group) {
			// Insert single-line comment(s)
			const topCommentNodes = tryGetSingleLineCommentNodesOnTheTopOf(_.first(inputNode.nodes))
			if (topCommentNodes.length > 0) {
				outputBuffer.append(topCommentNodes.map(node => travel(inputNode.parent, node, indentLevel)).join(''))
			}

			// Insert CSS selector(s)
			const separator = ',' + (options.insertNewLineBetweenSelectors ? (options.newLineChar + indent) : ' ')
			outputBuffer.append(indent + inputNode.nodes.map(node => travel(inputNode, node, indentLevel, true)).join(separator).trim())

			outputBuffer.append(travel(inputNode, inputNode.block, indentLevel, false, { potentialCommentNodeInsideTheBlock: _.last(inputNode.nodes) }))

		} else if (inputNode instanceof stylus.nodes.Root || inputNode instanceof stylus.nodes.Block) {
			const childIndentLevel = inputNode instanceof stylus.nodes.Root ? 0 : (indentLevel + 1)

			if (inputNode instanceof stylus.nodes.Block && options.insertBraces) {
				outputBuffer.append(' {')
			}

			// Insert a comment on the right of the last selector
			const sideCommentNode = tryGetMultiLineCommentNodeOnTheRightOf(data.potentialCommentNodeInsideTheBlock) || tryGetSingleLineCommentNodeOnTheRightOf(data.potentialCommentNodeInsideTheBlock)
			if (sideCommentNode) {
				if (options.insertSpaceBeforeComments) {
					outputBuffer.append(' ')
				}
				outputBuffer.append(travel(inputNode.parent, sideCommentNode, indentLevel, true))
			}

			outputBuffer.append(options.newLineChar)

			// Filter multi-line comment(s)
			const commentNodes = inputNode.nodes.filter(node => node instanceof stylus.nodes.Comment)

			const groups = []
			_.difference(inputNode.nodes, commentNodes).forEach((node, rank, list) => {
				if (rank > 0 && node.toJSON().__type === list[rank - 1].toJSON().__type && node.block === undefined) {
					_.last(groups).push(node)
				} else {
					groups.push([node])
				}
			})

			// Sort CSS properties
			groups.filter(group => group[0] instanceof stylus.nodes.Property).forEach(group => {
				let newGroup = group
				if (options.sortProperties === 'alphabetical') {
					newGroup = _.sortBy(group, node => node.segments.map(segment => segment.name).join(''))
				} else if (options.sortProperties === 'grouped') {
					newGroup = _.sortBy(group, node => {
						const propertyName = node.segments.map(segment => segment.name).join('')
						const propertyRank = ordering.grouped.indexOf(propertyName)
						if (propertyRank >= 0) {
							return propertyRank
						} else {
							return Infinity
						}
					})
				}

				groups[groups.indexOf(group)] = newGroup
			})

			// Note that do not mutate this
			const nonCommentNodes = _.flatten(groups)

			// Put single-line comment(s) to the relevant node
			nonCommentNodes.forEach(node => {
				node.commentsOnTop = tryGetSingleLineCommentNodesOnTheTopOf(node)

				const rightCommentNode = tryGetSingleLineCommentNodeOnTheRightOf(node)
				if (rightCommentNode) {
					if (node.commentsOnRight === undefined) {
						node.commentsOnRight = []
					}
					node.commentsOnRight.push(rightCommentNode)
				}
			})

			// Put a sticky multi-line comment to the relevant node
			_.orderBy(commentNodes, ['lineno', 'column'], ['desc', 'asc']).forEach(comment => {
				const sideNode = nonCommentNodes.find(node => node.lineno === comment.lineno && node.column < comment.column)
				if (sideNode) {
					if (sideNode.commentsOnRight === undefined) {
						sideNode.commentsOnRight = []
					}
					sideNode.commentsOnRight.push(comment)

				} else {
					const index = inputNode.nodes.indexOf(comment)
					if (index === inputNode.nodes.length - 1) {
						groups.push([comment])

					} else {
						let belowNode = inputNode.nodes[index + 1]
						if (_.includes(nonCommentNodes, belowNode)) {
							if (belowNode.commentsOnTop === undefined) {
								belowNode.commentsOnTop = []
							}
							belowNode.commentsOnTop.push(comment)

						} else if (belowNode instanceof stylus.nodes.Comment) {
							belowNode = nonCommentNodes.find(node => node.commentsOnTop && node.commentsOnTop.find(node => belowNode === node))
							belowNode.commentsOnTop.unshift(comment)
						}
					}
				}
			})

			// Insert CSS body
			outputBuffer.append(groups.map(group =>
				group.map(node =>
					travel(inputNode, node, childIndentLevel)
				).join('')
			).join(_.repeat(options.newLineChar, options.insertNewLineBetweenGroups)))

			// Insert the bottom comment(s)
			const bottomCommentNodes = tryGetSingleLineCommentNodesOnTheBottomOf(_.last(nonCommentNodes))
			if (bottomCommentNodes) {
				outputBuffer.append(bottomCommentNodes.map(node => travel(inputNode.parent, node, childIndentLevel)).join(''))
			}

			if (inputNode instanceof stylus.nodes.Block && options.insertBraces) {
				outputBuffer.append(indent + '}')
				outputBuffer.append(options.newLineChar)
			}

		} else if (inputNode instanceof stylus.nodes.Selector) {
			outputBuffer.append(inputNode.segments.map(segment => travel(inputNode, segment, indentLevel, true)).join(''))
			if (inputNode.optional === true) {
				outputBuffer.append('!optional')
			}

		} else if (inputNode instanceof stylus.nodes.Property) {
			// Insert the property name
			outputBuffer.append(indent + inputNode.segments.map(segment => travel(inputNode, segment, indentLevel, true)).join(''))

			if (options.insertColons) {
				outputBuffer.append(':')
			}
			outputBuffer.append(' ')

			// Insert the property value(s)
			if (inputNode.expr instanceof stylus.nodes.Expression) {
				// Extract the last portion of comments
				const lastComments = _.chain(inputNode.expr.nodes).clone().reverse().takeWhile(node => node instanceof stylus.nodes.Comment).reverse().value()
				const nodesExcludingLastComments = inputNode.expr.nodes.slice(0, inputNode.expr.nodes.length - lastComments.length)

				// Insert the property value(s) without the last portion of comments
				// Hence it will be, for example,
				// margin: 8px /* middle-comment */ 0; /* last-comment */
				outputBuffer.append(nodesExcludingLastComments.map(node => travel(inputNode, node, indentLevel, true)).join(' '))

				// Put the last portion of comments aside
				if (lastComments.length > 0) {
					if (inputNode.commentsOnRight === undefined) {
						inputNode.commentsOnRight = []
					}
					inputNode.commentsOnRight = inputNode.commentsOnRight.concat(lastComments)
				}

			} else {
				warnings.push({ message: 'Found unknown object', data: inputNode })
			}

			if (options.insertSemicolons) {
				outputBuffer.append(';')
			}
			outputBuffer.append(options.newLineChar)

		} else if (inputNode instanceof stylus.nodes.Literal) {
			if (_.isObject(inputNode.parent) && (inputNode.parent instanceof stylus.nodes.Root || inputNode.parent instanceof stylus.nodes.Block)) { // In case of @css
				// Note that it must be wrapped inside a pair of braces
				// TODO: make "\s\s..." to "\t"
				outputBuffer.append('@css {' + options.newLineChar)
				outputBuffer.append(_.trim(inputNode.val.replace(/\r?\n/g, options.newLineChar), options.newLineChar) + options.newLineChar)
				outputBuffer.append('}' + options.newLineChar)

			} else {
				if (_.get(lines, (inputNode.lineno - 1) + '.' + (inputNode.column - 1)) === '\\') {
					outputBuffer.append('\\')
				}
				outputBuffer.append(inputNode.val)
			}

		} else if (inputNode instanceof stylus.nodes.String) {
			outputBuffer.append(options.stringQuoteChar)
			outputBuffer.append(inputNode.val)
			outputBuffer.append(options.stringQuoteChar)

		} else if (inputNode instanceof stylus.nodes.Ident) {
			if (insideExpression === false) {
				outputBuffer.append(indent)
			}

			// Replace the identifier name with '@' for anonymous functions
			const currentIsAnonymousFunc = inputNode.name === 'anonymous' && inputNode.val instanceof stylus.nodes.Function && inputNode.val.name === 'anonymous'
			if (currentIsAnonymousFunc) {
				outputBuffer.append('@')
			} else {
				outputBuffer.append(inputNode.name)
			}

			if (inputNode.val instanceof stylus.nodes.Function) {
				outputBuffer.append(travel(inputNode, inputNode.val, indentLevel, false))

			} else if (inputNode.val instanceof stylus.nodes.Expression) { // In case of assignments
				outputBuffer.append(' = ')
				outputBuffer.append(travel(inputNode, inputNode.val, indentLevel, true))

			} else if (inputNode.val instanceof stylus.nodes.BinOp && inputNode.val.left instanceof stylus.nodes.Ident && inputNode.val.left.name === inputNode.name && inputNode.val.right) { // In case of self-assignments
				outputBuffer.append(' ' + inputNode.val.op + '= ' + travel(inputNode.val, inputNode.val.right, indentLevel, true))
			}

			const currentHasChildOfAnonymousFunc = inputNode.val instanceof stylus.nodes.Expression && inputNode.val.nodes.length === 1 && inputNode.val.nodes[0] instanceof stylus.nodes.Ident && inputNode.val.nodes[0].val instanceof stylus.nodes.Function && inputNode.val.nodes[0].val.name === 'anonymous'

			const currentHasChildOfAtblock = inputNode.val instanceof stylus.nodes.Expression && inputNode.val.nodes.length === 1 && inputNode.val.nodes[0] instanceof stylus.nodes.Atblock

			if (insideExpression === false) {
				if (options.insertSemicolons && !(inputNode.val instanceof stylus.nodes.Function || currentHasChildOfAnonymousFunc || currentHasChildOfAtblock)) {
					outputBuffer.append(';')
				}
				outputBuffer.append(options.newLineChar)
			}

		} else if (inputNode instanceof stylus.nodes.Function) {
			// Insert the parameter list
			outputBuffer.append('(' + travel(inputNode, inputNode.params, indentLevel, true) + ')')

			// Insert the function body
			outputBuffer.append(travel(inputNode, inputNode.block, indentLevel, false, { potentialCommentNodeInsideTheBlock: _.last(inputNode.params.nodes) }))

			// Trim a new-line generated by `Block` because it will cancel a new-line generated by `Ident`
			outputBuffer.remove(options.newLineChar)

		} else if (inputNode instanceof stylus.nodes.Params) {
			outputBuffer.append(inputNode.nodes.map(node => travel(inputNode, node, indentLevel, true) + (node.rest ? '...' : '')).join(', '))

		} else if (inputNode instanceof stylus.nodes.Call) {
			if (inputNode.block) { // In case of block mixins
				outputBuffer.append('+')
			}

			outputBuffer.append(inputNode.name)

			if (inputNode.name === 'url' && inputNode.args.nodes.length === 1 && inputNode.args.nodes[0] instanceof stylus.nodes.Expression && inputNode.args.nodes[0].nodes.length > 1) { // In case of `url(non-string)`
				const modifiedArgument = new stylus.nodes.Arguments()
				modifiedArgument.nodes = [new stylus.nodes.String(inputNode.args.nodes[0].nodes.map(node => travel(inputNode.args, node, indentLevel, true)).join(''))]
				outputBuffer.append(travel(inputNode, modifiedArgument, indentLevel, true))

			} else {
				outputBuffer.append(travel(inputNode, inputNode.args, indentLevel, true))
			}

			if (inputNode.block) { // In case of block mixins
				outputBuffer.append(travel(inputNode, inputNode.block, indentLevel))
			}

		} else if (inputNode instanceof stylus.nodes.Return) {
			outputBuffer.append('return ' + travel(inputNode, inputNode.expr, indentLevel, true))

			if (insideExpression === false) {
				if (options.insertSemicolons) {
					outputBuffer.append(';')
				}
				outputBuffer.append(options.newLineChar)
			}

		} else if (inputNode instanceof stylus.nodes.Arguments) {
			outputBuffer.append('(')
			if (_.some(inputNode.map)) { // In case of named-arguments
				outputBuffer.append(_.toPairs(inputNode.map).map(pair =>
					pair[0] + ': ' + travel(inputNode, pair[1], indentLevel, true)
				).join(', '))

			} else {
				outputBuffer.append(inputNode.nodes.map(node => travel(inputNode, node, indentLevel, true)).join(', '))
			}
			outputBuffer.append(')')

		} else if (inputNode instanceof stylus.nodes.Expression) {
			if (insideExpression === false) {
				outputBuffer.append(indent)
			}

			const parentIsSelector = inputNode.parent instanceof stylus.nodes.Selector
			if (parentIsSelector) {
				outputBuffer.append('{')
			}

			const currentIsPartOfPropertyNames = !!travelUpUntil(inputNode, node => node instanceof stylus.nodes.Property && node.segments.includes(inputNode))

			const currentIsPartOfKeyframes = !!travelUpUntil(inputNode, node => node instanceof stylus.nodes.Keyframes && node.segments.includes(inputNode))

			outputBuffer.append(inputNode.nodes.map(node => {
				if (node instanceof stylus.nodes.Ident && (currentIsPartOfPropertyNames || currentIsPartOfKeyframes || insideExpression === false) || node.mixin === true) {
					return '{' + travel(inputNode, node, indentLevel, true) + '}'
				} else {
					return travel(inputNode, node, indentLevel, true)
				}
			}).join(' '))

			if (parentIsSelector) {
				outputBuffer.append('}')
			}

			if (insideExpression === false) {
				if (options.insertSemicolons) {
					outputBuffer.append(';')
				}
				outputBuffer.append(options.newLineChar)
			}

		} else if (inputNode instanceof stylus.nodes.Unit) {
			outputBuffer.append(inputNode.val).append(inputNode.type)

		} else if (inputNode instanceof stylus.nodes.UnaryOp) {
			outputBuffer.append(inputNode.op === '!' && options.alwaysUseNot ? 'not ' : inputNode.op).append(travel(inputNode, inputNode.expr, indentLevel, true))

		} else if (inputNode instanceof stylus.nodes.BinOp) {
			if (inputNode.op === '[]') { // In case of array accessing
				outputBuffer.append(travel(inputNode, inputNode.left, indentLevel, true))
				outputBuffer.append('[' + travel(inputNode, inputNode.right, indentLevel, true) + ']')

			} else if (inputNode.op === '...') { // In case of ranges
				outputBuffer.append(travel(inputNode, inputNode.left, indentLevel, true))
				outputBuffer.append('...')
				outputBuffer.append(travel(inputNode, inputNode.right, indentLevel, true))

			} else if (inputNode.op === '[]=') { // In case of object-property assignments
				outputBuffer.append(travel(inputNode, inputNode.left, indentLevel, true))
				outputBuffer.append('[')
				outputBuffer.append(travel(inputNode, inputNode.right, indentLevel, true))
				outputBuffer.append('] = ')
				outputBuffer.append(travel(inputNode, inputNode.val, indentLevel, true))

			} else {
				const escapeDivider = inputNode.op === '/'
				if (escapeDivider) {
					outputBuffer.append('(')
				}

				outputBuffer.append(travel(inputNode, inputNode.left, indentLevel, true))
				outputBuffer.append(' ' + inputNode.op)
				if (inputNode.right) {
					outputBuffer.append(' ' + travel(inputNode, inputNode.right, indentLevel, true))
				}

				if (escapeDivider) {
					outputBuffer.append(')')
				}
			}

		} else if (inputNode instanceof stylus.nodes.Ternary) {
			if (insideExpression === false) {
				outputBuffer.append(indent)
			}

			if (insideExpression === false && inputNode.cond instanceof stylus.nodes.BinOp && inputNode.cond.op === 'is defined') {
				inputNode.cond.parent = inputNode

				outputBuffer.append(inputNode.cond.left.name)
				outputBuffer.append(' ?= ')
				outputBuffer.append(travel(inputNode.cond, inputNode.cond.left.val, indentLevel, true))

			} else {
				outputBuffer.append(travel(inputNode, inputNode.cond, indentLevel, true))
				outputBuffer.append(' ? ')
				outputBuffer.append(travel(inputNode, inputNode.trueExpr, indentLevel, true))
				outputBuffer.append(' : ')
				outputBuffer.append(travel(inputNode, inputNode.falseExpr, indentLevel, true))
			}

			if (insideExpression === false) {
				if (options.insertSemicolons) {
					outputBuffer.append(';')
				}
				outputBuffer.append(options.newLineChar)
			}

		} else if (inputNode instanceof stylus.nodes.Boolean) {
			outputBuffer.append(inputNode.val.toString())

		} else if (inputNode instanceof stylus.nodes.RGBA) {
			outputBuffer.append(inputNode.raw.trim())

		} else if (inputNode instanceof stylus.nodes.Object) {
			const keyValuePairs = _.toPairs(inputNode.vals)
			if (keyValuePairs.length === 0) { // In case of an empty object
				outputBuffer.append('{}')

			} else if (keyValuePairs.map(pair => pair[1]).every(node => node.lineno === inputNode.lineno)) { // In case of one-line object-property spreading
				outputBuffer.append('{ ')
				outputBuffer.append(keyValuePairs.map(pair =>
					getProperVariableName(pair[0]) + ': ' +
					travel(inputNode, pair[1], indentLevel, true)
				).join(', '))
				outputBuffer.append(' }')

			} else { // In case of multiple-line object-property spreading
				const childIndent = indent + options.indentChar
				outputBuffer.append('{' + options.newLineChar)
				outputBuffer.append(keyValuePairs.map(pair =>
					childIndent +
					getProperVariableName(pair[0]) + ': ' +
					travel(inputNode, pair[1], indentLevel + 1, true)
				).join(',' + options.newLineChar))
				outputBuffer.append(options.newLineChar + indent + '}')
			}

		} else if (inputNode instanceof stylus.nodes.If) {
			if (insideExpression === false) {
				outputBuffer.append(indent)
			}

			const operation = inputNode.negate ? 'unless' : 'if'

			if (inputNode.postfix === true) {
				// Insert the `if` body
				outputBuffer.append(travel(inputNode, inputNode.block, indentLevel, true))
				outputBuffer.append(' ' + operation + ' ')

				// Insert the `if` condition
				if (options.insertParenthesisAroundConditions) {
					outputBuffer.append('(')
				}
				outputBuffer.append(travel(inputNode, inputNode.cond, indentLevel, true))
				if (options.insertParenthesisAroundConditions) {
					outputBuffer.append(')')
				}

				if (insideExpression === false) {
					if (options.insertSemicolons) {
						outputBuffer.append(';')
					}
					outputBuffer.append(options.newLineChar)
				}

			} else {
				if (insideExpression) {
					outputBuffer.append(' ')
				}

				// Insert the `if` condition
				outputBuffer.append(operation + ' ')
				if (options.insertParenthesisAroundConditions) {
					outputBuffer.append('(')
				}
				outputBuffer.append(travel(inputNode, inputNode.cond, indentLevel, true))
				if (options.insertParenthesisAroundConditions) {
					outputBuffer.append(')')
				}

				// Insert the `if` body
				outputBuffer.append(travel(inputNode, inputNode.block, indentLevel, false))

				// Insert `else` block(s)
				if (inputNode.elses.length > 0) {
					if (options.insertNewLineBetweenElseIf === false) {
						outputBuffer.remove(options.newLineChar)
					}

					inputNode.elses.forEach((node, rank, list) => {
						if (options.insertNewLineBetweenElseIf === true) {
							outputBuffer.append(indent)
						} else {
							outputBuffer.append(' ')
						}

						outputBuffer.append('else')
						outputBuffer.append(travel(inputNode, node, indentLevel, true))

						// Remove the extra new-line generated by `Block`
						if (options.insertNewLineBetweenElseIf === false && rank < list.length - 1) {
							outputBuffer.remove(options.newLineChar)
						}
					})
				}
			}

		} else if (inputNode instanceof stylus.nodes.Each) {
			if (insideExpression === false) {
				outputBuffer.append(indent)
			}

			const currentHasOnlyOneChild = _.size(inputNode.block.nodes) === 1
			const currentIsOnTheSameLineAsBody = inputNode.lineno === inputNode.block.nodes[0].lineno && inputNode.block.nodes[0].column < inputNode.column
			if (currentHasOnlyOneChild && currentIsOnTheSameLineAsBody) { // In case of postfix
				outputBuffer.append(travel(inputNode, inputNode.block.nodes[0], indentLevel, true))
				outputBuffer.append(' for ')
				outputBuffer.append(_.compact([inputNode.val, inputNode.key]).join(', '))
				outputBuffer.append(' in ')
				outputBuffer.append(travel(inputNode, inputNode.expr, indentLevel, true))

				if (insideExpression === false) {
					if (options.insertSemicolons) {
						outputBuffer.append(';')
					}
					outputBuffer.append(options.newLineChar)
				}

			} else {
				outputBuffer.append('for ')
				outputBuffer.append(_.compact([inputNode.val, inputNode.key]).join(', '))
				outputBuffer.append(' in ')
				outputBuffer.append(travel(inputNode, inputNode.expr, indentLevel, true))
				outputBuffer.append(travel(inputNode, inputNode.block, indentLevel, false))
			}

		} else if (inputNode instanceof stylus.nodes.Media) {
			outputBuffer.append(indent + '@media ')
			outputBuffer.append(travel(inputNode, inputNode.val, indentLevel))
			outputBuffer.append(travel(inputNode, inputNode.block, indentLevel))

		} else if (inputNode instanceof stylus.nodes.Keyframes) {
			outputBuffer.append('@keyframes ')
			outputBuffer.append(inputNode.segments.map(segment => travel(inputNode, segment, indentLevel, true)).join(', '))
			outputBuffer.append(travel(inputNode, inputNode.block, indentLevel))

		} else if (inputNode instanceof stylus.nodes.QueryList) {
			outputBuffer.append(inputNode.nodes.map(node => travel(inputNode, node, indentLevel, true)).join(', '))

		} else if (inputNode instanceof stylus.nodes.Query) {
			outputBuffer.append(inputNode.type.val)
			if (inputNode.type.val && inputNode.nodes.length > 0) {
				outputBuffer.append(' and ')
			}
			outputBuffer.append(inputNode.nodes.map(node => travel(inputNode, node, indentLevel, true)).join(' and '))

		} else if (inputNode instanceof stylus.nodes.Feature) {
			outputBuffer.append('(')
			outputBuffer.append(inputNode.segments.map(segment => travel(inputNode, segment, indentLevel, true)).join(''))
			outputBuffer.append(': ')
			outputBuffer.append(travel(inputNode, inputNode.expr, indentLevel, true))
			outputBuffer.append(')')

		} else if (inputNode instanceof stylus.nodes.Supports) {
			outputBuffer.append(indent + '@supports ')
			outputBuffer.append(travel(inputNode, inputNode.condition, indentLevel, true))
			outputBuffer.append(travel(inputNode, inputNode.block, indentLevel, false))

		} else if (inputNode instanceof stylus.nodes.Atrule) {
			outputBuffer.append(indent + '@' + inputNode.type)
			if (_.some(inputNode.segments)) {
				outputBuffer.append(' ')
				outputBuffer.append(inputNode.segments.map(segment => travel(inputNode, segment, indentLevel, true)).join(''))
			}
			outputBuffer.append(travel(inputNode, inputNode.block, indentLevel))

		} else if (inputNode instanceof stylus.nodes.Extend) {
			outputBuffer.append(indent + '@extends ')
			outputBuffer.append(inputNode.selectors.map(node => travel(inputNode, node, indentLevel, true)).join(', '))
			outputBuffer.append(options.newLineChar)

		} else if (inputNode instanceof stylus.nodes.Atblock) {
			if (options.insertBraces) {
				outputBuffer.append('@block')
			} else {
				outputBuffer.remove(' ')
			}

			outputBuffer.append(travel(inputNode, inputNode.block, indentLevel))

			// Remove the extra new-line because of `Ident` and `Block`
			outputBuffer.remove(options.newLineChar)

		} else if (inputNode instanceof stylus.nodes.Comment && inputNode.str.startsWith('//')) { // In case of single-line comments
			if (insideExpression === false) {
				outputBuffer.append(indent)
			}
			outputBuffer.append('//' + (options.insertSpaceAfterComments ? ' ' : ''))
			outputBuffer.append(inputNode.str.substring(2).trim())
			if (insideExpression === false) {
				outputBuffer.append(options.newLineChar)
			}

		} else if (inputNode instanceof stylus.nodes.Comment && inputNode.str.startsWith('/*')) { // In case of multi-line comments
			const spaceAfterComment = (options.insertSpaceAfterComments ? ' ' : '')

			// Split into an array of lines
			let commentLines = inputNode.str.split(/\r?\n/).map(line => line.trim())

			if (commentLines.length === 1) { // In case of one line only
				// Add a white-space between /* and */
				commentLines[0] = '/*' + spaceAfterComment + commentLines[0].substring(2, commentLines[0].length - 2).trim() + spaceAfterComment + '*/'

			} else { // In case of multiple lines
				const documenting = _.first(commentLines).startsWith('/**')

				// Add a white-space after /*
				if (_.first(commentLines) !== '/*' && documenting === false) {
					commentLines[0] = '/*' + spaceAfterComment + _.first(commentLines).substring(2).trim()
				}

				// Add indentation to in-between lines
				let zeroBasedLineIndex = 0
				while (++zeroBasedLineIndex <= commentLines.length - 2) {
					if (documenting) {
						if (commentLines[zeroBasedLineIndex].startsWith('*')) {
							if (commentLines[zeroBasedLineIndex].substring(1).charAt(0) === ' ') {
								commentLines[zeroBasedLineIndex] = ' *' + commentLines[zeroBasedLineIndex].substring(1)
							} else {
								commentLines[zeroBasedLineIndex] = ' *' + spaceAfterComment + commentLines[zeroBasedLineIndex].substring(1)
							}
						} else {
							commentLines[zeroBasedLineIndex] = ' *' + spaceAfterComment + commentLines[zeroBasedLineIndex]
						}
					} else {
						commentLines[zeroBasedLineIndex] = '  ' + spaceAfterComment + commentLines[zeroBasedLineIndex]
					}
				}

				// Add a white-space before */
				if (_.last(commentLines) === '*/') {
					if (documenting) {
						commentLines[commentLines.length - 1] = ' ' + _.last(commentLines)
					}
				} else {
					commentLines[commentLines.length - 1] = '   ' + _.trimEnd(_.last(commentLines).substring(0, _.last(commentLines).length - 2)) + spaceAfterComment + '*/'
				}
			}

			if (insideExpression) {
				// For example,
				// margin: 8px /* standard */ 0;
				outputBuffer.append(commentLines.join(options.newLineChar))

			} else {
				outputBuffer.append(commentLines.map(line => indent + line).join(options.newLineChar)).append(options.newLineChar)
			}

		} else if (typeof inputNode === 'string') {
			outputBuffer.append(inputNode)

		} else {
			warnings.push({ message: 'Found unknown object', data: inputNode })
		}

		if (inputNode.commentsOnRight) {
			outputBuffer.remove(options.newLineChar)
			if (options.insertSpaceBeforeComments) {
				outputBuffer.append(' ')
			}
			outputBuffer.append(inputNode.commentsOnRight.map(node => travel(inputNode.parent, node, indentLevel, true)).join(''))
			outputBuffer.append(options.newLineChar)
		}

		return outputBuffer.toString()
	}

	function tryGetSingleLineCommentNodesOnTheTopOf(inputNode) {
		// Skip operation for `Group` type
		if (inputNode instanceof stylus.nodes.Group) {
			return []
		}

		const commentNodes = []
		let zeroBasedLineIndex = inputNode.lineno - 1
		while (--zeroBasedLineIndex >= 0 && lines[zeroBasedLineIndex] !== undefined && lines[zeroBasedLineIndex].trim().startsWith('//')) {
			commentNodes.unshift(new stylus.nodes.Comment(lines[zeroBasedLineIndex].trim(), false, false))
		}
		return commentNodes
	}

	function tryGetSingleLineCommentNodesOnTheBottomOf(inputNode) {
		if (!inputNode) {
			return null
		}

		// Skip operation for `Group` type
		if (inputNode instanceof stylus.nodes.Group) {
			return null
		}

		const commentNodes = []
		let zeroBasedLineIndex = inputNode.lineno - 1
		const sourceNodeIndent = lines[zeroBasedLineIndex].substring(0, lines[zeroBasedLineIndex].length - _.trimStart(lines[zeroBasedLineIndex]).length)
		while (++zeroBasedLineIndex < lines.length && lines[zeroBasedLineIndex].trim().startsWith('//') && lines[zeroBasedLineIndex].startsWith(sourceNodeIndent)) {
			commentNodes.push(new stylus.nodes.Comment(lines[zeroBasedLineIndex].trim(), false, false))
		}
		return commentNodes
	}

	function tryGetSingleLineCommentNodeOnTheRightOf(inputNode) {
		if (!inputNode || lines[inputNode.lineno - 1] !== undefined && lines[inputNode.lineno - 1].substring(inputNode.column - 1).includes('//') === false) {
			return null
		}

		// Skip operation for `Group` type
		if (inputNode instanceof stylus.nodes.Group) {
			return null
		}

		let sideCommentText = lines[inputNode.lineno - 1]
		if (sideCommentText === undefined) {
			return null
		}

		sideCommentText = sideCommentText.substring(sideCommentText.indexOf('//', inputNode.column)).trim()
		return new stylus.nodes.Comment(sideCommentText, false, false)
	}

	function tryGetMultiLineCommentNodeOnTheRightOf(inputNode) {
		if (!inputNode || lines[inputNode.lineno - 1].substring(inputNode.column - 1).includes('/*') === false) {
			return null
		}

		let zeroBasedLineIndex = inputNode.lineno - 1
		let sideCommentText = lines[zeroBasedLineIndex]
		sideCommentText = sideCommentText.substring(sideCommentText.indexOf('/*', inputNode.column))
		if (sideCommentText.includes('*/')) {
			sideCommentText = sideCommentText.substring(0, sideCommentText.indexOf('*/') + 2)
		} else {
			while (++zeroBasedLineIndex < lines.length) {
				if (sideCommentText.includes('*/')) {
					sideCommentText = sideCommentText.substring(0, sideCommentText.indexOf('*/') + 2)
					break
				} else {
					sideCommentText += options.newLineChar
					sideCommentText += lines[zeroBasedLineIndex]
				}
			}
		}
		return new stylus.nodes.Comment(sideCommentText, false, false)
	}

	function travelUpUntil(inputNode, condition) {
		const workingNode = inputNode && inputNode.parent
		if (!workingNode) {
			return null
		} else if (condition(workingNode)) {
			return workingNode
		} else {
			return travelUpUntil(workingNode, condition)
		}
	}

	function getProperVariableName(name) {
		if (/^\d/.test(name) || /\s/.test(name)) {
			return options.stringQuoteChar + name + options.stringQuoteChar
		} else {
			return name
		}
	}

	let output = travel(null, rootNode, 0)
	if (output.startsWith(options.newLineChar)) {
		output = output.substring(options.newLineChar.length)
	}
	if (output.endsWith(options.newLineChar) && content.includes('\n') && content.substring(content.lastIndexOf('\n') + 1).trim().length > 0) {
		output = output.substring(0, output.length - options.newLineChar.length)
	}

	return {
		tree: rootNode,
		text: output,
		warnings,
	}
}

module.exports.format = format