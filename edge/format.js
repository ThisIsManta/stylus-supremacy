const StylusParser = require('stylus/lib/parser')
const StylusNode = require('stylus/lib/nodes')
const get = require('lodash/get')
const first = require('lodash/first')
const last = require('lodash/last')
const findLast = require('lodash/findLast')
const compact = require('lodash/compact')
const difference = require('lodash/difference')
const sortBy = require('lodash/sortBy')
const uniq = require('lodash/uniq')
const partition = require('lodash/partition')
const takeRightWhile = require('lodash/takeRightWhile')
const min = require('lodash/min')
const maxBy = require('lodash/maxBy')
const escapeRegExp = require('lodash/escapeRegExp')
const trimStart = require('lodash/trimStart')
const trimEnd = require('lodash/trimEnd')
const isObject = require('lodash/isObject')
const isPlainObject = require('lodash/isPlainObject')
const isString = require('lodash/isString')
const isInteger = require('lodash/isInteger')
const isBoolean = require('lodash/isBoolean')

const schema = require('./schema')
const createFormattingOptions = require('./createFormattingOptions')
const createStringBuffer = require('./createStringBuffer')
const sortedProperties = require('./createSortedProperties')()
const findChildNodes = require('./findChildNodes')

function format(content, options = {}) {
	// Stop processing if the input content is empty
	if (content.trim().length === 0) {
		return ''
	}

	// Consolidate the formatting options
	options = Object.assign({ wrapMode: !!options.wrapMode }, createFormattingOptions(options))

	// Prepare the artifacts
	const comma = options.insertSpaceAfterComma ? ', ' : ','
	const openParen = options.insertSpaceInsideParenthesis ? '( ' : '('
	const closeParen = options.insertSpaceInsideParenthesis ? ' )' : ')'

	// Store the input content line-by-line
	const originalLines = content.split(/\r?\n/)

	let modifiedContent = content
	let originalTabStopChar = null // For example, "\t", "\s\s" and so on
	let originalBaseIndent = null // This could be zero or many occurrences of `originalTabStopChar`
	if (options.wrapMode) {
		// Wrap the input content in `wrap{...}` so that it has a root node
		// This is designed for https://github.com/ThisIsManta/vscode-stylus-supremacy
		if (originalLines.length === 1) {
			modifiedContent = 'wrap\n\t' + content.trim()
			originalBaseIndent = get(content.match(/^(\s|\t)*/g), '0', null)

		} else {
			// Determine an original tab stop character
			const twoShortestIndent = sortBy(
				uniq(
					originalLines
						.filter(line => line.trim().length > 0)
						.map(line => get(line.match(/^(\s|\t)*/g), '0', ''))
				),
				text => text.length
			).slice(0, 2)
			if (twoShortestIndent.length === 2) {
				originalTabStopChar = twoShortestIndent[1].substring(twoShortestIndent[0].length)
			}
			originalBaseIndent = twoShortestIndent[0]

			// Normalize the original indentation
			modifiedContent = 'wrap\n' + originalLines.map(line => {
				if (line.trim().length > 0) {
					return (originalTabStopChar || '\t') + line.substring(twoShortestIndent[0].length)
				} else {
					return ''
				}
			}).join('\n')
		}
	}

	// Used to determine some information that `rootNode` does not offer
	// For example, a single-line comment
	const modifiedLines = modifiedContent.split(/\r?\n/)

	// Store the Stylus parsed tree
	const rootNode = new StylusParser(modifiedContent, { cache: false }).parse()

	// Return the original content if it only has comments
	if (rootNode.nodes.every(node => node instanceof StylusNode.Comment)) {
		return content
	}

	function travel(parentNode, inputNode, indentLevel, insideExpression = false, data = {}) {
		// Check argument type
		if (!(isObject(parentNode) || parentNode === null && inputNode instanceof StylusNode.Root)) {
			throw new Error(`Found a parent node of ${JSON.stringify(parentNode)}`)
		} else if (!(isObject(inputNode))) {
			throw new Error(`Found an input node of ${JSON.stringify(inputNode)}` + (parentNode ? `, which had a parent node of ${JSON.stringify(parentNode)}` : ''))
		} else if (!(isInteger(indentLevel) && indentLevel >= 0)) {
			throw new Error(`Found an indent level of ${JSON.stringify(indentLevel)}`)
		} else if (!(isBoolean(insideExpression))) {
			throw new Error(`Found an expression flag of ${JSON.stringify(insideExpression)}`)
		} else if (!(isPlainObject(data))) {
			throw new Error(`Found an additional data object of ${JSON.stringify(data)}`)
		}

		// Inject a parent node to the current working node
		inputNode.parent = parentNode

		// Prepare the indentation from the current indent level
		const indent = options.tabStopChar.repeat(indentLevel)

		// Store an output string for the current node
		const outputBuffer = createStringBuffer()

		// Insert sticky comment(s) before the current node
		if (inputNode.commentsOnTop) {
			outputBuffer.append(inputNode.commentsOnTop.map(node => travel(inputNode.parent, node, indentLevel)).join(''))
		}

		if (inputNode instanceof StylusNode.Import) {
			outputBuffer.append(indent)
			outputBuffer.append('@')
			outputBuffer.append(options.alwaysUseImport || inputNode.once === false ? 'import' : 'require')
			outputBuffer.append(' ')
			outputBuffer.append(travel(inputNode, inputNode.path, indentLevel, true))

			if (insideExpression === false) {
				if (options.insertSemicolons) {
					outputBuffer.append(';')
				}
				outputBuffer.append(options.newLineChar)
			}

		} else if (inputNode instanceof StylusNode.Group) {
			// Insert single-line comment(s)
			const topCommentNodes = tryGetSingleLineCommentNodesOnTheTopOf(first(inputNode.nodes))
			if (topCommentNodes.length > 0) {
				outputBuffer.append(topCommentNodes.map(node => travel(inputNode.parent, node, indentLevel)).join(''))
			}

			// Insert CSS selector(s)
			let separator = options.selectorSeparator
			if (options.insertNewLineBetweenSelectors && separator.includes('\n') === false) {
				separator = separator.trim() + '\n'
			}
			separator = separator.replace(/\r?\n/, options.newLineChar + indent)

			outputBuffer.append(indent + inputNode.nodes.map(node => travel(inputNode, node, indentLevel, true)).join(separator).trim())

			outputBuffer.append(travel(inputNode, inputNode.block, indentLevel, false, { potentialCommentNodeInsideTheBlock: last(inputNode.nodes) }))

		} else if (inputNode instanceof StylusNode.Root || inputNode instanceof StylusNode.Block) {
			const childIndentLevel = inputNode instanceof StylusNode.Root ? 0 : (indentLevel + 1)

			if (inputNode instanceof StylusNode.Block && (parentNode instanceof StylusNode.Atblock ? options.alwaysUseAtBlock : options.insertBraces)) {
				outputBuffer.append(' {')
			}

			// Filter consecutive multi-line comment(s)
			const groupOfCommentNodes = [[]]
			inputNode.nodes.forEach(node => {
				const lastGroup = last(groupOfCommentNodes)
				if (node instanceof StylusNode.Comment) {
					lastGroup.push(node)

				} else if (lastGroup.length > 0) {
					groupOfCommentNodes.push([])
				}
			})
			if (last(groupOfCommentNodes).length === 0) {
				groupOfCommentNodes.pop()
			}

			const unsortedNonCommentNodes = difference(
				inputNode.nodes,
				groupOfCommentNodes.flat()
			)

			// Insert a comment on the right of the last selector
			const sideCommentNode = tryGetMultiLineCommentNodeOnTheRightOf(data.potentialCommentNodeInsideTheBlock) || tryGetSingleLineCommentNodeOnTheRightOf(data.potentialCommentNodeInsideTheBlock)
			if (sideCommentNode) {
				if (options.insertSpaceBeforeComment) {
					outputBuffer.append(' ')
				}
				outputBuffer.append(travel(inputNode.parent, sideCommentNode, indentLevel, true))

				// Remove the first multi-line comment because it has been processed above
				const blockCommentNode = inputNode.nodes[0]
				if (
					blockCommentNode instanceof StylusNode.Comment &&
					blockCommentNode.lineno === inputNode.lineno &&
					blockCommentNode.str === sideCommentNode.str &&
					blockCommentNode === groupOfCommentNodes[0][0]
				) {
					groupOfCommentNodes[0].shift()
				}
			}

			outputBuffer.append(options.newLineChar)

			// Insert single-comments for an empty block
			if (inputNode.nodes.length === 0) {
				const commentNodes = tryGetSingleLineCommentNodesOnTheBottomOf(inputNode)
				outputBuffer.append(commentNodes.map(node => travel(inputNode, node, childIndentLevel)).join(''))
			}

			const groupOfUnsortedNonCommentNodes = []
			unsortedNonCommentNodes.forEach((node, rank, list) => {
				if (rank === 0 || getType(node) !== getType(list[rank - 1]) || getType(node) === 'Block') {
					groupOfUnsortedNonCommentNodes.push([node])
				} else {
					last(groupOfUnsortedNonCommentNodes).push(node)
				}
			})

			const groupOfSortedNonCommentNodes = groupOfUnsortedNonCommentNodes.map(nodes => {
				if (nodes[0] instanceof StylusNode.Property) {
					// Sort CSS properties
					if (options.sortProperties === 'alphabetical') {
						return sortBy(nodes, node => {
							const propertyName = node.segments.map(segment => segment.name).join('')
							if (propertyName.startsWith('-')) {
								return '~' + propertyName.substring(1)
							} else {
								return propertyName
							}
						})

					} else if (options.sortProperties === 'grouped') {
						return sortBy(nodes, node => {
							const propertyName = node.segments.map(segment => segment.name).join('')
							const propertyRank = sortedProperties.indexOf(propertyName)
							if (propertyRank >= 0) {
								return propertyRank
							} else {
								return Infinity
							}
						})

					} else if (Array.isArray(options.sortProperties) && options.sortProperties.length > 0) {
						return sortBy(nodes, node => {
							const propertyName = node.segments.map(segment => segment.name).join('')
							const propertyRank = options.sortProperties.indexOf(propertyName)
							if (propertyRank >= 0) {
								return propertyRank
							} else {
								return Infinity
							}
						})
					}
				}

				return nodes
			})

			// Note that do not mutate this
			const sortedNonCommentNodes = groupOfSortedNonCommentNodes.flat()

			// Put single-line comment(s) to the relevant node
			sortedNonCommentNodes.forEach(node => {
				node.commentsOnTop = tryGetSingleLineCommentNodesOnTheTopOf(node)

				const rightCommentNode = tryGetSingleLineCommentNodeOnTheRightOf(node)
				if (rightCommentNode) {
					if (node.commentsOnRight === undefined) {
						node.commentsOnRight = []
					}
					node.commentsOnRight.push(rightCommentNode)
				}
			})

			groupOfCommentNodes.forEach(commentNodes => {
				const [rightCommentNodes, lineCommentNodes] = partition(commentNodes, commentNode => sortedNonCommentNodes.some(node => node.lineno === commentNode.lineno && node.column < commentNode.column))

				// Put the column-consecutive comment(s) on the right of the inner node
				rightCommentNodes.forEach(commentNode => {
					const leftNode = findLast(sortedNonCommentNodes, node => node.lineno === commentNode.lineno && node.column < commentNode.column)
					if (leftNode.commentsOnRight === undefined) {
						leftNode.commentsOnRight = []
					}
					leftNode.commentsOnRight.push(commentNode)
				})

				const index = inputNode.nodes.indexOf(last(lineCommentNodes))
				if (index === inputNode.nodes.length - 1) {
					// Put the line-consecutive comment(s) at the bottom-most of the block
					groupOfSortedNonCommentNodes.push(lineCommentNodes)

				} else {
					// Put the line-consecutive comment(s) on the top of the inner node
					const belowNode = inputNode.nodes[index + 1]
					if (sortedNonCommentNodes.includes(belowNode)) {
						if (belowNode.commentsOnTop === undefined) {
							belowNode.commentsOnTop = []
						}
						belowNode.commentsOnTop.push(...lineCommentNodes)
					}
				}
			})

			const checkIf = (value) => {
				if (value === true) {
					return true

				} else if (options.wrapMode) {
					return originalBaseIndent && originalBaseIndent.length > 0 ? value === 'nested' : value === 'root'

				} else {
					return inputNode instanceof StylusNode.Root ? value === 'root' : value === 'nested'
				}
			}

			// Insert CSS body and new-lines between them
			outputBuffer.append(groupOfSortedNonCommentNodes
				.flatMap((nodes) => {
					const nodeType = getType(nodes[0])

					let newLineOrEmpty = ''
					if (
						nodeType === 'Block' && checkIf(options.insertNewLineAroundBlocks) ||
						nodeType === 'Property' && checkIf(options.insertNewLineAroundProperties) ||
						nodeType === 'Import' && checkIf(options.insertNewLineAroundImports) ||
						nodeType === 'Other' && checkIf(options.insertNewLineAroundOthers)
					) {
						newLineOrEmpty = options.newLineChar
					}

					return compact([
						newLineOrEmpty,
						nodes.map(node => travel(inputNode, node, childIndentLevel)).join(''),
						newLineOrEmpty,
					])
				})
				.filter((text, rank, list) => text !== options.newLineChar || !(
					rank === 0 ||
					rank > 1 && list[rank - 1] === options.newLineChar ||
					rank === list.length - 1
				))
				.join('')
			)

			// Insert the bottom comment(s)
			const bottomCommentNodes = tryGetSingleLineCommentNodesOnTheBottomOf(last(unsortedNonCommentNodes))
			if (bottomCommentNodes) {
				outputBuffer.append(bottomCommentNodes.map(node => travel(inputNode.parent, node, childIndentLevel)).join(''))
			}

			if (inputNode instanceof StylusNode.Block && (parentNode instanceof StylusNode.Atblock ? options.alwaysUseAtBlock : options.insertBraces)) {
				outputBuffer.append(indent + '}')
				outputBuffer.append(options.newLineChar)
			}

		} else if (inputNode instanceof StylusNode.Selector) {
			outputBuffer.append(travelThroughSegments(inputNode, indentLevel).join('').trim())

			if (inputNode.optional === true) {
				outputBuffer.append(' !optional')
			}

		} else if (inputNode instanceof StylusNode.Property) {
			if (insideExpression === false) {
				outputBuffer.append(indent)
			}

			// Insert the property name
			const propertyName = travelThroughSegments(inputNode, indentLevel).join('')
			outputBuffer.append(propertyName)

			// Insert the property value(s)
			if (inputNode.expr instanceof StylusNode.Expression) {
				// Extract the last portion of comments
				// For example,
				// margin: 8px 0; /* right-comment */
				const commentsOnTheRight = takeRightWhile(inputNode.expr.nodes, node => node instanceof StylusNode.Comment)
				const nodesExcludingCommentsOnTheRight = inputNode.expr.nodes.slice(0, inputNode.expr.nodes.length - commentsOnTheRight.length)

				let propertyValues = nodesExcludingCommentsOnTheRight.map(node => travel(inputNode, node, indentLevel, true))

				// Reduce the redundant margin/padding values
				// For example,
				// margin: 0 0 0 0; => margin: 0;
				// margin: 5px 0 5px 0; => margin: 5px 0;
				if (options.reduceMarginAndPaddingValues && (propertyName === 'margin' || propertyName === 'padding') && nodesExcludingCommentsOnTheRight.some(node => node instanceof StylusNode.Comment) === false) {
					if (propertyValues.length > 1 && propertyValues.every(text => text === propertyValues[0])) {
						propertyValues = [propertyValues[0]]

					} else if (propertyValues.length >= 3 && propertyValues[0] === propertyValues[2] && (propertyValues[1] === propertyValues[3] || propertyValues[3] === undefined)) {
						propertyValues = [propertyValues[0], propertyValues[1]]

					} else if (propertyValues.length === 4 && propertyValues[0] !== propertyValues[2] && propertyValues[1] === propertyValues[3]) {
						propertyValues = [propertyValues[0], propertyValues[1], propertyValues[2]]
					}
				}

				if (propertyName === 'border' || propertyName === 'outline') {
					if (options.alwaysUseNoneOverZero && propertyValues.length === 1 && /^0(\.0*)?(\w+|\%)?/.test(propertyValues[0])) {
						propertyValues = ['none']
					}
				}

				// See https://github.com/ThisIsManta/stylus-supremacy/issues/79
				const preserveColons = nodesExcludingCommentsOnTheRight.length === 1 && nodesExcludingCommentsOnTheRight[0] instanceof StylusNode.Expression

				// Insert the property value(s) without the last portion of comments
				if (nodesExcludingCommentsOnTheRight.every(node => node instanceof StylusNode.Expression)) {
					const numberOfLineTaken = uniq(nodesExcludingCommentsOnTheRight.map(({ lineno }) => lineno)
					).length
					if (numberOfLineTaken > 1 && options.preserveNewLinesBetweenPropertyValues) {
						outputBuffer.append(':' + options.newLineChar)
						const innerIndent = indent + options.tabStopChar
						outputBuffer.append(innerIndent)
						outputBuffer.append(propertyValues.join((inputNode.expr.isList ? ',' : '') + options.newLineChar + innerIndent))

					} else {
						if (options.insertColons || preserveColons) {
							outputBuffer.append(':')
						}
						outputBuffer.append(' ')
						outputBuffer.append(propertyValues.join(inputNode.expr.isList ? comma : ' '))
					}

				} else {
					if (options.insertColons || preserveColons) {
						outputBuffer.append(':')
					}
					outputBuffer.append(' ')
					outputBuffer.append(propertyValues.join(' '))
				}

				// Put the last portion of comments aside
				if (commentsOnTheRight.length > 0) {
					if (inputNode.commentsOnRight === undefined) {
						inputNode.commentsOnRight = []
					}
					inputNode.commentsOnRight = inputNode.commentsOnRight.concat(commentsOnTheRight)
				}

			} else {
				const error = new Error('Found unknown object')
				error.data = inputNode
				throw error
			}

			if (insideExpression === false) {
				if (options.insertSemicolons) {
					outputBuffer.append(';')
				}
				outputBuffer.append(options.newLineChar)
			}

		} else if (inputNode instanceof StylusNode.Literal) {
			if (inputNode.parent instanceof StylusNode.Property && inputNode.parent.expr.nodes.length === 1 && inputNode.parent.expr.nodes[0] === inputNode) { // In case of @css property
				// Note that it must be wrapped inside a pair of braces
				outputBuffer.append('@css {')
				if (inputNode.val.trim().length > 0) {
					outputBuffer.append(' ' + inputNode.val.trim() + ' ')
				}
				outputBuffer.append('}')

			} else if (inputNode.parent instanceof StylusNode.Root || inputNode.parent instanceof StylusNode.Block) { // In case of @css block
				// Note that it must be wrapped inside a pair of braces
				outputBuffer.append('@css {' + options.newLineChar)

				let innerLines = inputNode.val.split(/\r?\n/)

				// Adjust the original indentation
				if (innerLines.length === 1) {
					innerLines[0] = indent + innerLines[0].trim()

				} else if (innerLines.length >= 2) {
					const firstNonEmptyLineIndex = innerLines.findIndex(line => line.trim().length > 0)
					if (firstNonEmptyLineIndex >= 0) {
						innerLines = innerLines.slice(firstNonEmptyLineIndex)
						const firstLineIndent = innerLines[0].match(/^(\s|\t)+/)
						if (firstLineIndent) {
							const indentPattern = new RegExp(firstLineIndent[0], 'g')
							innerLines = innerLines.map(line => {
								const text = trimStart(line)
								const innerIndent = line.substring(0, line.length - text.length)
								return innerIndent.replace(indentPattern, options.tabStopChar) + text
							})
						}
					}
					if (last(innerLines).trim().length === 0) {
						innerLines = innerLines.slice(0, innerLines.length - 1)
					}
				}

				outputBuffer.append(innerLines.join(options.newLineChar))

				outputBuffer.append(options.newLineChar)
				outputBuffer.append('}' + options.newLineChar)

			} else {
				if (get(modifiedLines, (inputNode.lineno - 1) + '.' + (inputNode.column - 1)) === '\\') {
					outputBuffer.append('\\')
				}

				if (isString(inputNode.val)) {
					outputBuffer.append(inputNode.val)
				} else {
					outputBuffer.append(travel(inputNode, inputNode.val, indentLevel, true))
				}
			}

		} else if (inputNode instanceof StylusNode.String) {
			if (inputNode.val.includes(options.quoteChar)) {
				if (inputNode.val.startsWith('data:image/svg+xml;utf8,')) { // In case of SVG data-URL
					const counterQuoteChar = schema.quoteChar.enum.find(item => item !== options.quoteChar)

					// Convert single/double quotes
					outputBuffer.append(options.quoteChar)
					outputBuffer.append(inputNode.val.replace(new RegExp(options.quoteChar, 'g'), counterQuoteChar))
					outputBuffer.append(options.quoteChar)

				} else { // Use the existing quote character as Stylus does not support escaping quote characters
					outputBuffer.append(inputNode.quote)
					outputBuffer.append(inputNode.val)
					outputBuffer.append(inputNode.quote)
				}

			} else {
				outputBuffer.append(options.quoteChar)
				outputBuffer.append(inputNode.val)
				outputBuffer.append(options.quoteChar)
			}

		} else if (inputNode instanceof StylusNode.Ident) {
			if (insideExpression === false) {
				outputBuffer.append(indent)
			}

			if (inputNode.property === true) { // In case of property lookup
				outputBuffer.append('@')
			}

			// Replace the identifier name with '@' for anonymous functions
			const currentIsAnonymousFunc = inputNode.name === 'anonymous' && inputNode.val instanceof StylusNode.Function && inputNode.val.name === 'anonymous'
			if (currentIsAnonymousFunc) {
				outputBuffer.append('@')
			} else {
				outputBuffer.append(inputNode.name)
			}

			if (checkIfMixin(inputNode)) {
				outputBuffer.append(travel(inputNode, inputNode.val, indentLevel, false))

			} else if (inputNode.val instanceof StylusNode.Expression) { // In case of assignments
				outputBuffer.append(' = ')
				const temp = travel(inputNode, inputNode.val, indentLevel, true)
				if (temp.startsWith(' ') || temp.startsWith(options.newLineChar)) {
					outputBuffer.remove(' ')
				}
				outputBuffer.append(temp)

			} else if (inputNode.val instanceof StylusNode.BinOp && inputNode.val.left instanceof StylusNode.Ident && inputNode.val.left.name === inputNode.name && inputNode.val.right) { // In case of self-assignments
				outputBuffer.append(' ' + inputNode.val.op + '= ')
				outputBuffer.append(travel(inputNode, inputNode.val.right, indentLevel, true))
			}

			const currentHasChildOfAnonymousFunc = inputNode.val instanceof StylusNode.Expression && inputNode.val.nodes.length === 1 && inputNode.val.nodes[0] instanceof StylusNode.Ident && inputNode.val.nodes[0].val instanceof StylusNode.Function && inputNode.val.nodes[0].val.name === 'anonymous'

			const currentHasChildOfAtblock = inputNode.val instanceof StylusNode.Expression && inputNode.val.nodes.length === 1 && inputNode.val.nodes[0] instanceof StylusNode.Atblock

			if (insideExpression === false) {
				if (options.insertSemicolons && !(inputNode.val instanceof StylusNode.Function || currentHasChildOfAnonymousFunc || currentHasChildOfAtblock)) {
					outputBuffer.append(';')
				}
				outputBuffer.append(options.newLineChar)
			}

		} else if (inputNode instanceof StylusNode.Function) {
			// Insert the parameter list
			outputBuffer.append(openParen)
			outputBuffer.append(travel(inputNode, inputNode.params, indentLevel, true))
			outputBuffer.append(closeParen)

			let potentialCommentNodeInsideTheBlock
			if (checkIfMixin(inputNode.parent)) {
				potentialCommentNodeInsideTheBlock = inputNode.block
			} else {
				potentialCommentNodeInsideTheBlock = last(inputNode.params.nodes)
			}

			// Insert the function body
			outputBuffer.append(travel(inputNode, inputNode.block, indentLevel, false, { potentialCommentNodeInsideTheBlock }))

			// Trim a new-line generated by `Block` because it will cancel a new-line generated by `Ident`
			outputBuffer.remove(options.newLineChar)

		} else if (inputNode instanceof StylusNode.Params) {
			outputBuffer.append(inputNode.nodes.map(node => travel(inputNode, node, indentLevel, true) + (node.rest ? '...' : '')).join(comma))

		} else if (inputNode instanceof StylusNode.Call) {
			if (inputNode.block) { // In case of block mixins
				outputBuffer.append(indent + '+')
			}

			outputBuffer.append(inputNode.name)

			if (inputNode.name === 'url' && inputNode.args.nodes.length === 1 && inputNode.args.nodes[0] instanceof StylusNode.Expression && inputNode.args.nodes[0].nodes.length > 1) { // In case of `url(non-string)`
				const modifiedArgument = new StylusNode.Arguments()
				modifiedArgument.nodes = [new StylusNode.String(inputNode.args.nodes[0].nodes.map(node => travel(inputNode.args.nodes[0], node, indentLevel, true)).join(''))]
				outputBuffer.append(travel(inputNode, modifiedArgument, indentLevel, true))

			} else {
				outputBuffer.append(travel(inputNode, inputNode.args, indentLevel, true))
			}

			if (inputNode.block) { // In case of block mixins
				outputBuffer.append(travel(inputNode, inputNode.block, indentLevel))
			}

		} else if (inputNode instanceof StylusNode.Return) {
			if (insideExpression === false) {
				outputBuffer.append(indent)
			}

			outputBuffer.append('return ')
			outputBuffer.append(travel(inputNode, inputNode.expr, indentLevel, true))

			if (insideExpression === false) {
				if (options.insertSemicolons) {
					outputBuffer.append(';')
				}
				outputBuffer.append(options.newLineChar)
			}

		} else if (inputNode instanceof StylusNode.Arguments) {
			outputBuffer.append(openParen)

			const keyNodePairs = [
				// In case of ordinal arguments
				inputNode.nodes.map(node => ['', node]),
				// In case of named arguments
				Object.entries(inputNode.map)
					.map(pair => [pair[0] + ': ', pair[1]])
			].flat()

			const lineCount = uniq(keyNodePairs.map(pair => pair[1].lineno)).length

			if (lineCount > 1) {
				outputBuffer.append(options.newLineChar + indent + options.tabStopChar)
			}

			const separator = lineCount > 1
				? (',' /* Do not use the variable "comma" as it may end with a white-space */ + options.newLineChar + indent + options.tabStopChar)
				: comma

			outputBuffer.append(keyNodePairs.map(pair =>
				pair[0] +
				travel(inputNode, pair[1], indentLevel, true)
			).join(separator))

			if (lineCount > 1) {
				outputBuffer.append(options.newLineChar + indent)
			}

			outputBuffer.append(closeParen)

		} else if (inputNode instanceof StylusNode.Expression) {
			if (insideExpression === false) {
				outputBuffer.append(indent)
			}

			(function () {
				// Handle the special case for a unit suffix
				if (
					inputNode.nodes.length === 2 &&
					inputNode.nodes[0] instanceof StylusNode.BinOp &&
					inputNode.nodes[1] instanceof StylusNode.Ident
				) {
					outputBuffer.append(openParen)
					outputBuffer.append(travel(inputNode, inputNode.nodes[0], indentLevel, true))
					outputBuffer.append(closeParen)
					outputBuffer.append(travel(inputNode, inputNode.nodes[1], indentLevel, true))
					return
				}

				const parentIsArithmeticOperator =
					inputNode.parent instanceof StylusNode.UnaryOp ||
					(
						inputNode.nodes.length === 1 &&
						inputNode.nodes[0] instanceof StylusNode.BinOp &&
						inputNode.parent instanceof StylusNode.BinOp &&
						inputNode.parent.op !== '[]' &&
						inputNode.parent.op !== '[]='
					)
				const parentIsStringInterpolation =
					inputNode.parent instanceof StylusNode.BinOp &&
					inputNode.parent.op === '%' &&
					inputNode.parent.right === inputNode &&
					inputNode.nodes.length > 1
				const parentIsNestedExpression =
					inputNode.nodes.length === 1 &&
					inputNode.parent instanceof StylusNode.Expression &&
					!(inputNode.parent instanceof StylusNode.Arguments) && // Note that `Arguments` type inherits `Expression` type
					inputNode.parent.parent &&
					(
						inputNode.parent.parent instanceof StylusNode.Expression &&
						!(inputNode.parent.parent instanceof StylusNode.Arguments) &&
						inputNode.parent.parent.nodes.indexOf(inputNode.parent) >= 1 || // Note that this is a bug from Stylus compiler where it adds extra Expression node
						inputNode.parent.parent instanceof StylusNode.Feature ||
						inputNode.parent.parent instanceof StylusNode.Ident ||
						inputNode.parent.parent instanceof StylusNode.If ||
						inputNode.parent.parent instanceof StylusNode.Each ||
						inputNode.parent.parent instanceof StylusNode.Selector ||
						inputNode.parent.parent instanceof StylusNode.Return ||
						inputNode.parent.parent instanceof StylusNode.Arguments ||
						inputNode.parent.parent instanceof StylusNode.Object ||
						inputNode.parent.parent instanceof StylusNode.BinOp && inputNode.parent.parent.op === '[]'
					) === false
				const currentIsEmpty =
					inputNode.nodes.length === 0 &&
					inputNode.parent instanceof StylusNode.Expression &&
					!(inputNode.parent instanceof StylusNode.Arguments) && // Note that `Arguments` type inherits `Expression` type
					inputNode.parent.nodes.length === 1
				const currentIsDivision =
					inputNode.nodes.length === 1 &&
					inputNode.nodes[0] instanceof StylusNode.BinOp &&
					inputNode.nodes[0].op === '/'
				const currentIsNegation =
					inputNode.nodes.length === 1 &&
					inputNode.nodes[0] instanceof StylusNode.UnaryOp &&
					inputNode.nodes[0].op === '-'
				const currentHasParenthesis =
					parentIsArithmeticOperator ||
					parentIsStringInterpolation ||
					parentIsNestedExpression ||
					currentIsEmpty ||
					currentIsDivision ||
					currentIsNegation
				if (currentHasParenthesis) {
					outputBuffer.append(openParen)
				}

				outputBuffer.append(inputNode.nodes.map((node, rank, list) => {
					// Use either a white-space or a comma as a separator
					let separator = ' '
					if (rank === 0) {
						separator = ''
					} else if (inputNode.isList) {
						separator = comma
					}

					if (node instanceof StylusNode.Ident && insideExpression === false) {
						return separator + '{' + travel(inputNode, node, indentLevel, true) + '}'
					}

					return separator + travel(inputNode, node, indentLevel, true)
				}).join(''))

				if (currentHasParenthesis) {
					outputBuffer.append(closeParen)
				}
			})()

			if (insideExpression === false) {
				if (options.insertSemicolons) {
					outputBuffer.append(';')
				}
				outputBuffer.append(options.newLineChar)
			}

		} else if (inputNode instanceof StylusNode.Unit) {
			if (!options.insertLeadingZeroBeforeFraction && typeof inputNode.val === 'number' && Math.abs(inputNode.val) < 1 && inputNode.val !== 0) {
				if (inputNode.val < 0) {
					outputBuffer.append('-')
				}
				outputBuffer.append(Math.abs(inputNode.val).toString().substring(1))
			} else {
				outputBuffer.append(inputNode.val)
			}

			if (checkIfFlexBasis(inputNode) && inputNode.val === 0) {
				// See https://github.com/philipwalton/flexbugs#flexbug-4
				outputBuffer.append('%')

			} else if (!options.alwaysUseZeroWithoutUnit || inputNode.val !== 0 || inputNode.type === 's' || inputNode.type === 'ms') {
				outputBuffer.append(inputNode.type)
			}

		} else if (inputNode instanceof StylusNode.UnaryOp) {
			outputBuffer.append(inputNode.op === '!' && options.alwaysUseNot ? 'not ' : inputNode.op)

			const content = travel(inputNode, inputNode.expr, indentLevel, true)

			const bareNegation = inputNode.op === '-' && content.startsWith(openParen) === false
			if (bareNegation) {
				if (options.insertParenthesisAfterNegation) {
					outputBuffer.append(openParen)
				} else {
					outputBuffer.append(' ')
				}
			}

			outputBuffer.append(content)

			if (bareNegation) {
				if (options.insertParenthesisAfterNegation) {
					outputBuffer.append(closeParen)
				}
			}

		} else if (inputNode instanceof StylusNode.BinOp) {
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
				if (inputNode.val instanceof StylusNode.Expression && inputNode.val.nodes.length === 1 && inputNode.val.nodes[0] instanceof StylusNode.Expression) {
					inputNode.val = inputNode.val.nodes[0]
				}
				outputBuffer.append(travel(inputNode, inputNode.val, indentLevel, true))

				if (insideExpression === false) {
					if (options.insertSemicolons) {
						outputBuffer.append(';')
					}
					outputBuffer.append(options.newLineChar)
				}

			} else {
				outputBuffer.append(travel(inputNode, inputNode.left, indentLevel, true))

				outputBuffer.append(' ' + inputNode.op)

				if (inputNode.right) {
					outputBuffer.append(' ' + travel(inputNode, inputNode.right, indentLevel, true))
				}
			}

		} else if (inputNode instanceof StylusNode.Ternary) {
			if (insideExpression === false) {
				outputBuffer.append(indent)
			}

			if (insideExpression === false && inputNode.cond instanceof StylusNode.BinOp && inputNode.cond.op === 'is defined') {
				inputNode.cond.parent = inputNode

				outputBuffer.append(inputNode.cond.left.name)
				outputBuffer.append(' ?= ')
				outputBuffer.append(travel(inputNode.cond.left, inputNode.cond.left.val, indentLevel, true))

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

		} else if (inputNode instanceof StylusNode.Boolean) {
			outputBuffer.append(inputNode.val.toString())

		} else if (inputNode instanceof StylusNode.RGBA) {
			outputBuffer.append(inputNode.raw.trim())

		} else if (inputNode instanceof StylusNode.Object) {
			const keyValuePairs = Object.entries(inputNode.vals)
			if (keyValuePairs.length === 0) { // In case of an empty object
				outputBuffer.append('{}')

			} else if (keyValuePairs.map(pair => pair[1]).every(node => node.lineno === inputNode.lineno)) { // In case of one-line object-property spreading
				outputBuffer.append('{ ')
				outputBuffer.append(keyValuePairs.map(pair =>
					getProperVariableName(pair[0]) + ': ' +
					travel(inputNode, pair[1], indentLevel, true)
				).join(comma))
				outputBuffer.append(' }')

			} else { // In case of multiple-line object-property spreading
				const childIndent = indent + options.tabStopChar
				outputBuffer.append('{' + options.newLineChar)
				outputBuffer.append(keyValuePairs.map(pair =>
					childIndent +
					getProperVariableName(pair[0]) + ': ' +
					travel(inputNode, pair[1], indentLevel + 1, true)
				).join(',' + options.newLineChar))
				outputBuffer.append(options.newLineChar + indent + '}')
			}

		} else if (inputNode instanceof StylusNode.Member) {
			outputBuffer.append(travel(inputNode, inputNode.left, indentLevel, true))
			outputBuffer.append('.')
			outputBuffer.append(travel(inputNode, inputNode.right, indentLevel, true))

			if (inputNode.val) {
				outputBuffer.append(' = ')
				if (inputNode.val instanceof StylusNode.Expression && inputNode.val.nodes.length === 1 && inputNode.val.nodes[0] instanceof StylusNode.Expression) {
					inputNode.val = inputNode.val.nodes[0]
				}
				outputBuffer.append(travel(inputNode, inputNode.val, indentLevel, true))
			}

		} else if (inputNode instanceof StylusNode.If) {
			if (insideExpression === false) {
				outputBuffer.append(indent)
			}

			const operation = inputNode.negate ? 'unless' : 'if'

			if (inputNode.postfix === true) {
				// Insert the `if` body
				outputBuffer.append(travel(inputNode, inputNode.block, indentLevel, true))
				outputBuffer.append(' ' + operation + ' ')

				// Insert the `if` condition
				if (checkForParenthesis(inputNode, options)) {
					outputBuffer.append(openParen)
				}
				outputBuffer.append(travel(inputNode, inputNode.cond, indentLevel, true))
				if (checkForParenthesis(inputNode, options)) {
					outputBuffer.append(closeParen)
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
				if (checkForParenthesis(inputNode, options)) {
					outputBuffer.append(openParen)
				}
				outputBuffer.append(travel(inputNode, inputNode.cond, indentLevel, true))
				if (checkForParenthesis(inputNode, options)) {
					outputBuffer.append(closeParen)
				}

				// Insert the `if` body
				outputBuffer.append(travel(inputNode, inputNode.block, indentLevel, false))

				// Insert `else` block(s)
				if (inputNode.elses.length > 0) {
					if (!options.insertNewLineBeforeElse) {
						outputBuffer.remove(options.newLineChar)
					}

					inputNode.elses.forEach((node, rank, list) => {
						if (!options.insertBraces) {
							outputBuffer.append(options.newLineChar)
							outputBuffer.append(indent)
						} else if (options.insertNewLineBeforeElse === true) {
							outputBuffer.append(indent)
						} else {
							outputBuffer.append(' ')
						}

						outputBuffer.append('else')
						outputBuffer.append(travel(inputNode, node, indentLevel, true))

						// Remove the extra new-line generated by `Block`
						if (!options.insertNewLineBeforeElse && rank < list.length - 1) {
							outputBuffer.remove(options.newLineChar)
						}
					})
				}
			}

		} else if (inputNode instanceof StylusNode.Each) {
			if (insideExpression === false) {
				outputBuffer.append(indent)
			}

			const currentHasOnlyOneChild = (inputNode.block.nodes || []).length === 1
			const currentIsOnTheSameLineAsBody = inputNode.lineno === inputNode.block.nodes[0].lineno && inputNode.block.nodes[0].column < inputNode.column
			if (currentHasOnlyOneChild && currentIsOnTheSameLineAsBody) { // In case of postfix
				outputBuffer.append(travel(inputNode, inputNode.block.nodes[0], indentLevel, true))
				outputBuffer.append(' for ')
				outputBuffer.append(compact([inputNode.val, inputNode.key]).join(comma))
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
				outputBuffer.append(compact([inputNode.val, inputNode.key]).join(comma))
				outputBuffer.append(' in ')
				outputBuffer.append(travel(inputNode, inputNode.expr, indentLevel, true))
				outputBuffer.append(travel(inputNode, inputNode.block, indentLevel, false))
			}

		} else if (inputNode instanceof StylusNode.Media) {
			outputBuffer.append(indent + '@media ')
			outputBuffer.append(travel(inputNode, inputNode.val, indentLevel))
			outputBuffer.append(travel(inputNode, inputNode.block, indentLevel))

		} else if (inputNode instanceof StylusNode.Keyframes) {
			outputBuffer.append(indent + '@keyframes ')
			outputBuffer.append(travelThroughSegments(inputNode, indentLevel).filter(text => text.trim().length > 0).join(''))
			outputBuffer.append(travel(inputNode, inputNode.block, indentLevel))

		} else if (inputNode instanceof StylusNode.QueryList) {
			outputBuffer.append(inputNode.nodes.map(node => travel(inputNode, node, indentLevel, true)).join(comma))

		} else if (inputNode instanceof StylusNode.Query) {
			if (inputNode.predicate) {
				outputBuffer.append(inputNode.predicate + ' ')
			}
			if (inputNode.type) {
				outputBuffer.append(travel(inputNode, inputNode.type, indentLevel, true))
			}
			if (inputNode.nodes.length > 0) {
				if (inputNode.type) {
					outputBuffer.append(' and ')
				}
				outputBuffer.append(inputNode.nodes.map(node => travel(inputNode, node, indentLevel, true)).join(' and '))
			}

		} else if (inputNode instanceof StylusNode.Feature) {
			if (inputNode.expr) {
				outputBuffer.append(openParen)
				outputBuffer.append(travelThroughSegments(inputNode, indentLevel).join(''))
				if (options.insertColons) {
					outputBuffer.append(':')
				}
				outputBuffer.append(' ')
				outputBuffer.append(travel(inputNode, inputNode.expr, indentLevel, true))
				outputBuffer.append(closeParen)

			} else {
				outputBuffer.append(travel(inputNode, inputNode.segments[0], indentLevel, true))
			}

		} else if (inputNode instanceof StylusNode.Supports) {
			outputBuffer.append(indent + '@supports ')
			outputBuffer.append(travel(inputNode, inputNode.condition, indentLevel, true))
			outputBuffer.append(travel(inputNode, inputNode.block, indentLevel, false))

		} else if (inputNode instanceof StylusNode.Extend) {
			outputBuffer.append(indent)
			if (options.alwaysUseExtends) {
				outputBuffer.append('@extends')
			} else {
				outputBuffer.append('@extend')
			}
			outputBuffer.append(' ')
			outputBuffer.append(inputNode.selectors.map(node => travel(inputNode, node, indentLevel, true)).join(comma))
			if (options.insertSemicolons) {
				outputBuffer.append(';')
			}
			outputBuffer.append(options.newLineChar)

		} else if (inputNode instanceof StylusNode.Atrule) {
			outputBuffer.append(indent + '@' + inputNode.type)
			if (inputNode.segments.length > 0) {
				outputBuffer.append(' ')
				outputBuffer.append(travelThroughSegments(inputNode, indentLevel).join(''))
				outputBuffer.remove(' ')
			}
			if (inputNode.block) {
				outputBuffer.append(travel(inputNode, inputNode.block, indentLevel))
			} else if (options.insertSemicolons) {
				outputBuffer.append(';')
				outputBuffer.append(options.newLineChar)
			}

		} else if (inputNode instanceof StylusNode.Atblock) {
			if (options.alwaysUseAtBlock) {
				outputBuffer.append('@block')
			}
			outputBuffer.append(travel(inputNode, inputNode.block, indentLevel))

			// Remove the extra new-line because of `Ident` and `Block`
			outputBuffer.remove(options.newLineChar)

		} else if (inputNode instanceof StylusNode.Charset) {
			outputBuffer.append('@charset ')
			outputBuffer.append(travel(inputNode, inputNode.val, indentLevel, true))

		} else if (inputNode instanceof StylusNode.Namespace) {
			outputBuffer.append('@namespace ')
			if (inputNode.prefix) {
				outputBuffer.append(inputNode.prefix + ' ')
			}
			// Note that `inputNode.val.val` is not a typo
			outputBuffer.append(travel(inputNode, inputNode.val.val, indentLevel, true))

			if (options.insertSemicolons) {
				outputBuffer.append(';')
			}
			outputBuffer.append(options.newLineChar)

		} else if (inputNode instanceof StylusNode.Null) {
			outputBuffer.append('null')

		} else if (inputNode instanceof StylusNode.Comment && inputNode.str.startsWith('//')) { // In case of single-line comments
			if (inputNode.insertNewLineAbove) {
				outputBuffer.append(options.newLineChar)
			}
			if (insideExpression === false) {
				outputBuffer.append(indent)
			}
			outputBuffer.append('//' + (options.insertSpaceAfterComment ? ' ' : ''))
			outputBuffer.append(inputNode.str.substring(2).trim())
			if (insideExpression === false) {
				outputBuffer.append(options.newLineChar)
			}

		} else if (inputNode instanceof StylusNode.Comment && inputNode.str.startsWith('/*')) { // In case of multi-line comments
			const spaceAfterComment = (options.insertSpaceAfterComment ? ' ' : '')

			// Split into an array of lines
			let commentLines = inputNode.str.split(/\r?\n/)

			const documenting = commentLines[0].startsWith('/*') && commentLines.slice(1).every(line => line.trim().startsWith('*'))

			if (commentLines.length === 1) { // In case of one line only
				// Add a white-space between /* and */
				commentLines[0] = '/*' + spaceAfterComment + commentLines[0].substring(2, commentLines[0].length - 2).trim() + spaceAfterComment + '*/'

				// Add indentation
				if (!insideExpression) {
					commentLines[0] = indent + commentLines[0]
				}

			} else { // In case of multiple lines
				// Add a white-space after /*
				if (commentLines[0] !== '/**') {
					commentLines[0] = ('/*' + spaceAfterComment + commentLines[0].substring(2).trim()).trim()
				}

				// Add indentation to in-between lines
				let zeroBasedLineIndex = 0
				while (++zeroBasedLineIndex <= commentLines.length - 2) {
					if (documenting) {
						const trimmedCurrentLine = commentLines[zeroBasedLineIndex].trim()
						if (trimmedCurrentLine.startsWith('*')) {
							if (trimmedCurrentLine.substring(1).charAt(0) === ' ') {
								commentLines[zeroBasedLineIndex] = ' *' + trimmedCurrentLine.substring(1)
							} else {
								commentLines[zeroBasedLineIndex] = ' *' + spaceAfterComment + trimmedCurrentLine.substring(1)
							}
						} else {
							commentLines[zeroBasedLineIndex] = ' *' + spaceAfterComment + commentLines[zeroBasedLineIndex]
						}
						commentLines[zeroBasedLineIndex] = trimEnd(commentLines[zeroBasedLineIndex])
					}
				}

				// Add a white-space before */
				if (last(commentLines).trim() === '*/') {
					if (documenting) {
						commentLines[commentLines.length - 1] = ' ' + last(commentLines).trim()
					}
				} else {
					commentLines[commentLines.length - 1] = trimEnd(last(commentLines).substring(0, last(commentLines).length - 2)) + spaceAfterComment + '*/'
				}

				// Add indentation
				if (documenting) {
					commentLines = commentLines.map(line => indent + line)
				} else {
					const originalIndentLong = min(
						commentLines
							.slice(1)
							.map(line => line.match(/^(\s|\t)*/g)[0].length)
					) || 0

					commentLines = commentLines.map((line, rank) => {
						if (rank === 0) {
							return indent + line
						} else {
							return indent + line.substring(originalIndentLong)
						}
					})
				}
			}

			outputBuffer.append(commentLines.join(options.newLineChar))

			if (!insideExpression) {
				outputBuffer.append(options.newLineChar)
			}

		} else {
			const error = new Error('Found unknown object')
			error.data = inputNode
			throw error
		}

		// Insert sticky comment(s) on the right of the current node
		if (inputNode.commentsOnRight) {
			outputBuffer.remove(options.newLineChar)
			if (options.insertSpaceBeforeComment) {
				outputBuffer.append(' ')
			}
			outputBuffer.append(inputNode.commentsOnRight.map(node => travel(inputNode.parent, node, indentLevel, true)).join(''))
			outputBuffer.append(options.newLineChar)
		}

		return outputBuffer.toString()
	}

	function travelThroughSegments(inputNode, indentLevel) {
		return inputNode.segments.map(segment => {
			if (segment instanceof StylusNode.Expression) {
				if (segment.nodes.length === 1 && segment.nodes[0] instanceof StylusNode.Expression) {
					segment = segment.nodes[0]
				}
				return '{' + travel(inputNode, segment, indentLevel, true) + '}'
			} else {
				return travel(inputNode, segment, indentLevel, true)
			}
		})
	}

	// Store the line indexes of single-line comments that have been processed
	// This prevents picking up duplicate comments
	const usedStandaloneSingleLineComments = {}

	function tryGetSingleLineCommentNodesOnTheTopOf(inputNode) {
		// Re-assign `inputNode` because of wrong mixin declaration `lineno`
		if (checkIfMixin(inputNode)) {
			const params = get(inputNode, 'val.params.nodes', [])
			if (params.length > 0) {
				inputNode = first(params)
			} else {
				inputNode = inputNode.val
			}
		}

		let zeroBasedLineIndex
		if (inputNode instanceof StylusNode.Group && Array.isArray(inputNode.nodes) && inputNode.nodes.length > 0) {
			zeroBasedLineIndex = inputNode.nodes[0].lineno - 1
		} else if (checkIfTernary(inputNode) && inputNode.cond.left.val.lineno < inputNode.lineno) {
			zeroBasedLineIndex = inputNode.cond.left.val.lineno - 1
		} else {
			zeroBasedLineIndex = inputNode.lineno - 1
		}

		if (modifiedLines[zeroBasedLineIndex] === undefined) {
			return []
		}

		const referenceNodeIndent = getIndent(modifiedLines[zeroBasedLineIndex])

		let commentNodes = []
		while (--zeroBasedLineIndex >= 0) {
			const text = modifiedLines[zeroBasedLineIndex].trim()
			if (text === '') {
				if (commentNodes.length > 0) {
					commentNodes[0].insertNewLineAbove = true
				}

			} else if (text.startsWith('//') === false) {
				break

			} else if (referenceNodeIndent !== getIndent(modifiedLines[zeroBasedLineIndex])) {
				break

			} else if (!usedStandaloneSingleLineComments[zeroBasedLineIndex]) {
				usedStandaloneSingleLineComments[zeroBasedLineIndex] = true
				commentNodes.unshift(new StylusNode.Comment(text, false, false))
			}
		}

		if (commentNodes.length > 0) {
			commentNodes[0].insertNewLineAbove = false
		}

		return commentNodes
	}

	function tryGetSingleLineCommentNodesOnTheBottomOf(inputNode) {
		if (!inputNode) {
			return null
		}

		// Skip operation for `Group` type
		if (inputNode instanceof StylusNode.Group) {
			return null
		}

		let zeroBasedLineIndex = inputNode.lineno - 1

		// Skip operation when `inputNode.lineno` is not valid
		if (modifiedLines[zeroBasedLineIndex] === undefined) {
			return null
		}

		const referenceNodeIndent = getIndent(modifiedLines[zeroBasedLineIndex])

		const commentNodes = []
		while (++zeroBasedLineIndex < modifiedLines.length && modifiedLines[zeroBasedLineIndex].trim().startsWith('//') && modifiedLines[zeroBasedLineIndex].startsWith(referenceNodeIndent)) {
			if (usedStandaloneSingleLineComments[zeroBasedLineIndex]) {
				break
			} else {
				usedStandaloneSingleLineComments[zeroBasedLineIndex] = true
				commentNodes.push(new StylusNode.Comment(modifiedLines[zeroBasedLineIndex].trim(), false, false))
			}
		}

		return commentNodes
	}

	function tryGetSingleLineCommentNodeOnTheRightOf(inputNode) {
		if (!inputNode || modifiedLines[inputNode.lineno - 1] !== undefined && modifiedLines[inputNode.lineno - 1].substring(inputNode.column - 1).includes('//') === false) {
			return null
		}

		// Skip operation for `Group` type
		if (inputNode instanceof StylusNode.Group) {
			return null
		}

		let currentLine = modifiedLines[inputNode.lineno - 1]
		if (currentLine === undefined) {
			return null
		}

		// Skip operation if the only "//" is in the string
		let zeroBasedLineIndex = inputNode.column
		const leftmostStringThatHasDoubleSlashes = maxBy(
			findChildNodes(inputNode, node => node instanceof StylusNode.String)
				.filter(node => node.lineno === inputNode.lineno && node.val.includes('//')),
			node => node.column
		)
		if (leftmostStringThatHasDoubleSlashes) {
			zeroBasedLineIndex = leftmostStringThatHasDoubleSlashes.column + leftmostStringThatHasDoubleSlashes.val.length + 1
		}

		const commentIndex = currentLine.indexOf('//', zeroBasedLineIndex)
		if (commentIndex === -1) {
			return null
		}

		return new StylusNode.Comment(currentLine.substring(commentIndex).trim(), false, false)
	}

	function tryGetMultiLineCommentNodeOnTheRightOf(inputNode) {
		if (!inputNode || modifiedLines[inputNode.lineno - 1].substring(inputNode.column - 1).includes('/*') === false) {
			return null
		}

		let zeroBasedLineIndex = inputNode.lineno - 1
		let currentLine = modifiedLines[zeroBasedLineIndex]
		currentLine = currentLine.substring(currentLine.indexOf('/*', inputNode.column))
		if (currentLine.includes('*/')) {
			currentLine = currentLine.substring(0, currentLine.indexOf('*/') + 2)
		} else {
			while (++zeroBasedLineIndex < modifiedLines.length) {
				if (currentLine.includes('*/')) {
					currentLine = currentLine.substring(0, currentLine.indexOf('*/') + 2)
					break
				} else {
					currentLine += options.newLineChar
					currentLine += modifiedLines[zeroBasedLineIndex]
				}
			}
		}
		return new StylusNode.Comment(currentLine, false, false)
	}

	function getType(inputNode) {
		if (
			inputNode instanceof StylusNode.Property ||
			inputNode instanceof StylusNode.If && inputNode.postfix && inputNode.block instanceof StylusNode.Property
		) {
			return 'Property'

		} else if (inputNode instanceof StylusNode.Import) {
			return 'Import'

		} else if (
			inputNode.block !== undefined ||
			(inputNode instanceof StylusNode.Ident && inputNode.val.block !== undefined)
		) {
			return 'Block'

		} else {
			return 'Other'
		}
	}

	function getProperVariableName(name) {
		if (/^-/.test(name) || /^\d/.test(name) || /\s/.test(name)) {
			return options.quoteChar + name + options.quoteChar
		} else {
			return name
		}
	}

	const outputText = travel(null, rootNode, 0)
	let outputLines = outputText.split(new RegExp(escapeRegExp(options.newLineChar)))

	// Trim a beginning new-line character
	if (first(outputLines).trim().length === 0) {
		outputLines.shift()
	}

	// Trim all trailing new-line characters
	while (outputLines.length > 0 && last(outputLines).trim().length === 0) {
		outputLines.pop()
	}

	if (options.wrapMode) {
		// Remove the wrap node block
		if (outputLines[0].startsWith('wrap')) {
			outputLines.shift()
		}
		if (options.insertBraces && last(outputLines).trim() === '}') {
			outputLines.pop()
		}

		// Remove the wrap node indentation
		outputLines = outputLines.map(line => line.startsWith(options.tabStopChar) ? line.substring(options.tabStopChar.length) : line)

		// Add the original base indentation
		if (originalBaseIndent && originalTabStopChar) {
			const outputBaseIndent = options.tabStopChar.repeat(originalBaseIndent.length / originalTabStopChar.length)
			outputLines = outputLines.map(line => line.trim().length > 0 ? (outputBaseIndent + line) : '')
		} else if (originalBaseIndent) {
			outputLines = outputLines.map(line => line.trim().length > 0 ? (originalBaseIndent + line) : '')
		}
	}

	// Add a beginning new-line character
	// Do not move this block
	if (originalLines[0].length === 0) {
		outputLines.unshift('')
	}

	// Add a trailing new-line character if the original content has it
	// Do not move this block
	if (originalLines.length > 1 && content.substring(content.lastIndexOf('\n') + 1).trim().length === 0) {
		outputLines.push('')
	}

	return outputLines.join(options.newLineChar)
}

function checkIfMixin(node) {
	return (
		node instanceof StylusNode.Ident &&
		node.val instanceof StylusNode.Function
	)
}

function checkIfTernary(node) {
	return (
		node instanceof StylusNode.Ternary &&
		node.cond instanceof StylusNode.BinOp &&
		node.cond.op === 'is defined' &&
		node.cond.left instanceof StylusNode.Ident &&
		node.cond.left.val instanceof StylusNode.Expression
	)
}

function checkIfFlexBasis(node) {
	return (
		node instanceof StylusNode.Unit &&
		node.parent instanceof StylusNode.Property &&
		node.parent.segments.length === 1 &&
		node.parent.segments[0] instanceof StylusNode.Ident &&
		(
			(
				node.parent.segments[0].name === 'flex' &&
				node.parent.expr.nodes[2] === node
			) ||
			(
				node.parent.segments[0].name === 'flex-basis' &&
				node.parent.expr.nodes[0] === node
			)
		)
	)
}

function checkForParenthesis(node, options) {
	// Note that `Arguments` type inherits `Expression` type
	if (
		node instanceof StylusNode.If &&
		options.insertParenthesisAroundIfCondition &&
		node.cond instanceof StylusNode.Expression &&
		node.cond.nodes.length === 1 &&
		checkForParenthesis(node.cond.nodes[0], options) === false
	) {
		return true
	}

	if (
		node instanceof StylusNode.Expression &&
		node instanceof StylusNode.Arguments === false &&
		node.nodes.length === 1 &&
		node.nodes[0] instanceof StylusNode.Expression &&
		node.nodes[0] instanceof StylusNode.Arguments === false
	) {
		return true
	}

	return false
}

function getIndent(line) {
	return line.substring(0, line.length - trimStart(line).length)
}

module.exports = format
