

/**
 * @version    0.5.0
 * @date       2015-07-24
 * @stability  2 - Unstable
 * @author     Lauri Rooden <lauri@rooden.ee>
 * @license    MIT License
 */

var dispatchMutation = require("./lib/dispatch-mutation");
var MutationObserver = require("./lib/mutation-observer");
var EventEmitter = require('events').EventEmitter;

function makeEmitter (element) {
  EventEmitter.call(element);
  EventEmitter.prototype.setMaxListeners.call(element, 1024);
  // Object.assign(element, EventEmitter.prototype);
}

// Void elements: http://www.w3.org/html/wg/drafts/html/master/syntax.html#void-elements
var voidElements = {
	AREA:1, BASE:1, BR:1, COL:1, EMBED:1, HR:1, IMG:1, INPUT:1,
	KEYGEN:1, LINK:1, MENUITEM:1, META:1, PARAM:1, SOURCE:1, TRACK:1, WBR:1
}
, hasOwn = Object.prototype.hasOwnProperty
, selector = require("selector-lite")
, elementGetters = {
	getElementById: function(id) {
		return selector.find(this, "#" + id, 1)
	},
	getElementsByTagName: function(tag) {
		return selector.find(this, tag)
	},
	getElementsByClassName: function(sel) {
		return selector.find(this, "." + sel.replace(/\s+/g, "."))
	},
	querySelector: function(sel) {
		return selector.find(this, sel, 1)
	},
	querySelectorAll: function(sel) {
		return selector.find(this, sel)
	}
}
, Node = {
	ELEMENT_NODE:                1,
	TEXT_NODE:                   3,
	PROCESSING_INSTRUCTION_NODE: 7,
	COMMENT_NODE:                8,
	DOCUMENT_NODE:               9,
	DOCUMENT_TYPE_NODE:         10,
	DOCUMENT_FRAGMENT_NODE:     11,
	nodeName:        null,
	parentNode:      null,
	ownerDocument:   null,
	childNodes:      null,
	attributeMap:    null,
	get nodeValue() {
		return this.nodeType === 3 || this.nodeType === 8 ? this.data : null
	},
	set nodeValue(text) {
		return this.nodeType === 3 || this.nodeType === 8 ? (this.data = text) : null
	},
	get textContent() {
		return this.hasChildNodes() ? this.childNodes.map(function(child) {
			return child[ child.nodeType == 3 ? "data" : "textContent" ]
		}).join("") : this.nodeType === 3 ? this.data : ""
	},
	set textContent(text) {
		if (this.nodeType === 3) return (this.data = text)
		for (var node = this; node.firstChild;) node.removeChild(node.firstChild)
		node.appendChild(node.ownerDocument.createTextNode(text))
	},
	get firstChild() {
		return this.childNodes && this.childNodes[0] || null
	},
	get lastChild() {
		return this.childNodes && this.childNodes[ this.childNodes.length - 1 ] || null
	},
	get previousSibling() {
		return getSibling(this, -1)
	},
	get nextSibling() {
		return getSibling(this, 1)
	},
	// innerHTML and outerHTML should be extensions to the Element interface
	get innerHTML() {
		return Node.toString.call(this)
	},
	set innerHTML(html) {
		var match, child
		, node = this
		, doc = node.ownerDocument || node
		, tagRe = /<(!--([\s\S]*?)--|!\[[\s\S]*?\]|[?!][\s\S]*?)>|<(\/?)([^ \/>]+)([^>]*?)(\/?)>|[^<]+/mg
		, attrRe = /([^= ]+)\s*=\s*(?:("|')((?:\\?.)*?)\2|(\S+))/g

		for (; node.firstChild; ) node.removeChild(node.firstChild)

		for (; (match = tagRe.exec(html)); ) {
			if (match[3]) {
				node = node.parentNode
			} else if (match[4]) {
				child = doc.createElement(match[4])
				if (match[5]) {
					match[5].replace(attrRe, setAttr)
				}
				node.appendChild(child)
				if (!voidElements[child.tagName] && !match[6]) node = child
			} else if (match[2]) {
				node.appendChild(doc.createComment(htmlUnescape(match[2])))
			} else if (match[1]) {
				node.appendChild(doc.createDocumentType(match[1]))
			} else {
				node.appendChild(doc.createTextNode(htmlUnescape(match[0])))
			}
		}

		return html

		function setAttr(_, name, q, a, b) {
			child.setAttribute(name, htmlUnescape(a || b || ""))
		}
	},
	get outerHTML() {
		return this.toString()
	},
	set outerHTML(html) {
		var frag = this.ownerDocument.createDocumentFragment()
		frag.innerHTML = html
		this.parentNode.replaceChild(frag, this)
		return html
	},
	get htmlFor() {
		return this["for"]
	},
	set htmlFor(value) {
		this["for"] = value
	},
	get className() {
		return this["class"] || ""
	},
	set className(value) {
		this["class"] = value
	},
	get style() {
		return this.styleMap || (this.styleMap = new StyleMap())
	},
	set style(value) {
		this.styleMap = new StyleMap(value)
	},
	hasChildNodes: function() {
		return this.childNodes && this.childNodes.length > 0
	},
	appendChild: function(el) {
		return this.insertBefore(el)
	},
	insertBefore: function(el, ref) {
		var node = this
		, childs = node.childNodes

		if (el.nodeType == 11) {
			while (el.firstChild) node.insertBefore(el.firstChild, ref)
		} else {
			if (el.parentNode) el.parentNode.removeChild(el)
			el.parentNode = node

			// If ref is null, insert el at the end of the list of children.
			childs.splice(ref ? childs.indexOf(ref) : childs.length, 0, el)
			// TODO:2015-07-24:lauri:update document.body and document.documentElement
		}

		this.attachedCallback && this.attachedCallback();

    dispatchMutation(this, {
      type: "childList",
      addedNodes: [el],
      removedNodes: [],
      target: this
    })

		return el
	},
	removeChild: function(el) {
		var node = this
		, index = node.childNodes.indexOf(el)
		if (index == -1) throw new Error("NOT_FOUND_ERR")

		node.childNodes.splice(index, 1)
		el.parentNode = null

		dispatchMutation(this, {
      type: "childList",
      addedNodes: [],
      removedNodes: [el],
      target: this
    })

    return el
	},
	replaceChild: function(el, ref) {
		this.insertBefore(el, ref)
		return this.removeChild(ref)
	},
	cloneNode: function(deep) {
		var key
		, node = this
		, clone = new node.constructor(node.tagName || node.data)
		clone.ownerDocument = node.ownerDocument
		clone.attributeMap = Object.assign({}, this.attributeMap);

		if (node.hasAttribute) {
			for (key in node) if (node.hasAttribute(key)) clone[key] = node[key].valueOf()
		}

		if (deep && node.hasChildNodes()) {
			node.childNodes.forEach(function(child) {
				clone.appendChild(child.cloneNode(deep))
			})
		}
		return clone
	},
	toString: function() {
		return this.hasChildNodes() ? this.childNodes.reduce(function(memo, node) {
			return memo + node
		}, "") : ""
	}
}



function extendNode(obj, extras) {
	obj.prototype = Object.create(Node)
	for (var descriptor, key, i = 1; (extras = arguments[i++]); ) {
		for (key in extras) {
			descriptor = Object.getOwnPropertyDescriptor(extras, key)
			Object.defineProperty(obj.prototype, key, descriptor)
		}
	}
	obj.prototype.constructor = obj
}

function camelCase(str) {
	return str.replace(/[ _-]+([a-z])/g, function(_, a) { return a.toUpperCase() })
}

function hyphenCase(str) {
	return str.replace(/[A-Z]/g, "-$&").toLowerCase()
}

function htmlEscape(str) {
	return str.replace(/&/g, "&amp;").replace(/"/g, "&quot;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
}

function htmlUnescape(str) {
	return str.replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&quot;/g, "\"").replace(/&amp;/g, "&")
}

function StyleMap(style) {
	var styleMap = this
	if (style) style.split(/\s*;\s*/g).map(function(val) {
		val = val.split(/\s*:\s*/)
		if(val[1]) styleMap[val[0] == "float" ? "cssFloat" : camelCase(val[0])] = val[1]
	})
}

StyleMap.prototype.valueOf = function() {
	var styleMap = this
	return Object.keys(styleMap).map(function(key) {
		return (key == "cssFloat" ? "float: " : hyphenCase(key) + ": ") + styleMap[key]
	}).join("; ")
}

function getSibling(node, step) {
	var silbings = node.parentNode && node.parentNode.childNodes
	, index = silbings && silbings.indexOf(node)

	return silbings && index > -1 && silbings[ index + step ] || null
}



function DocumentFragment() {
	this.childNodes = []
}

extendNode(DocumentFragment, {
	nodeType: 11,
	nodeName: "#document-fragment"
})

function Attr(node, name) {
	this.ownerElement = node
	this.name = name.toLowerCase()
}

Attr.prototype = {
	get value() { return HTMLElement.prototype.getAttribute.call(this.ownerElement, this.name) },
	set value(val) { HTMLElement.prototype.setAttribute(this.ownerElement, this.name, val) },
	toString: function() {
		var v;

		if (typeof this.value === 'string') {
			v = htmlEscape(this.value);
		} else {
			v = "";
		}

		return this.name + "=\"" + v + "\""
	}
}

function escapeAttributeName(name) {
  name = ("" + name).toLowerCase()
	if (name === "constructor" || name === "attributes") return name.toUpperCase()
	return name
}

function HTMLElement(tag) {
	var element = this
	element.nodeName = element.tagName = tag.toUpperCase()
	element.localName = tag.toLowerCase()
	element.childNodes = []
	element.attributeMap = {}
	makeEmitter(element);
}

function mappedAttribute (name) {
	var attributes = ["accept", "accesskey", "action", "align", "alt", "async", "autocomplete", "autofocus", "autoplay", "autosave", "bgcolor", "border", "buffered", "challenge", "charset", "checked", "cite", "class", "code", "codebase", "color", "cols", "colspan", "content", "contenteditable", "contextmenu", "controls", "coords", "data", "data-*", "datetime", "default", "defer", "dir", "dirname", "disabled", "download", "draggable", "dropzone", "enctype", "for", "form", "formaction", "headers", "height", "hidden", "high", "href", "hreflang", "icon", "id", "ismap", "itemprop", "keytype", "kind", "label", "lang", "language", "list", "loop", "low", "manifest", "max", "maxlength", "media", "method", "min", "multiple", "muted", "name", "novalidate", "open", "optimum", "pattern", "ping", "placeholder", "poster", "preload", "radiogroup", "readonly", "rel", "required", "reversed", "rows", "rowspan", "sandbox", "scope", "scoped", "seamless", "selected", "shape", "size", "sizes", "span", "spellcheck", "src", "srcdoc", "srclang", "srcset", "start", "step", "style", "summary", "tabindex", "target", "title", "type", "usemap", "value", "width", "wrap"]
	return attributes.indexOf(name) !== -1
}

extendNode(HTMLElement, elementGetters, {
	get attributes() {
		var keys = {};

		var key
		, attrs = []
		, element = this

		for (key in element) if (key === escapeAttributeName(key) && element.hasAttribute(key)) {
			keys[key] = true;
		}

		for (key in element.attributeMap) {
			keys[key] = true;
		}

		return Object.keys(keys).map((key) => {
			return new Attr(element, escapeAttributeName(key));
		});
	},
	matches: function(sel) {
		return selector.matches(this, sel)
	},
	closest: function(sel) {
		return selector.closest(this, sel)
	},
	addEventListener: EventEmitter.prototype.addListener,
	emit: EventEmitter.prototype.emit,
	dispatchEvent: EventEmitter.prototype.emit,
	classList: { 
		add: function () {},
		remove: function () {}
	},
	namespaceURI: "http://www.w3.org/1999/xhtml",
	nodeType: 1,
	localName: null,
	tagName: null,
	styleMap: null,
	hasAttribute: function(name) {
		name = escapeAttributeName(name)

		if (typeof this.attributeMap[name] !== "undefined") {
			return true;
		}

		if (name !== "style" && hasOwn.call(this, name) && mappedAttribute(name)) {
			return true;
		}

		if (name == "style" && this.styleMap) {
			return !!Object.keys(this.styleMap).length;
		}

		return false;
		// return name != "style" ? hasOwn.call(this, name) :
		// !!(this.styleMap && Object.keys(this.styleMap).length)
	},
	getAttribute: function(name) {
		var value;

		name = escapeAttributeName(name)

		if (!this.hasAttribute(name)) {
			return null;
		}

		if (typeof this.attributeMap[name] === "undefined") {
			value = this[name];
		} else {
			value = this.attributeMap[name];
		}

		return "" + value;
	},
	setAttribute: function(name, value) {
		if (value === null) {
			// ok
		} else if (typeof value !== 'string') {
			throw new Error(name + JSON.stringify(value));
		}

		this.attributeMap[escapeAttributeName(name)] = "" + value

		if (mappedAttribute(escapeAttributeName(name))) {
			this[escapeAttributeName(name)] = "" + value
		}

		dispatchMutation(this, {
      type: "attributes",
      attributeName: name,
      target: this
    })
	},
	removeAttribute: function(name) {
		name = escapeAttributeName(name)

		this.attributeMap[name] = ""
		delete this.attributeMap[name]

		this[name] = ""
		delete this[name]

		dispatchMutation(this, {
      type: "attributes",
      attributeName: name,
      target: this
    })
	},
	toString: function() {
		var attrs = this.attributes.join(" ")
		return "<" + this.localName + (attrs ? " " + attrs : "") + ">" +
		(voidElements[this.tagName] ? "" : this.innerHTML + "</" + this.localName + ">")
	}
})

function ElementNS(namespace, tag) {
	var element = this
	element.namespaceURI = namespace
	element.nodeName = element.tagName = element.localName = tag
	element.childNodes = []
	element.attributeMap = {}
	makeEmitter(element);
}

ElementNS.prototype = HTMLElement.prototype

function Text(data) {
	this.data = data
}

extendNode(Text, {
	nodeType: 3,
	nodeName: "#text",
	toString: function() {
		return htmlEscape("" + this.data)
	}
})

function Comment(data) {
	this.data = data
}

extendNode(Comment, {
	nodeType: 8,
	nodeName: "#comment",
	toString: function() {
		return "<!--" + this.data + "-->"
	}
})

function DocumentType(data) {
	this.data = data
}

extendNode(DocumentType, {
	nodeType: 10,
	toString: function() {
		return "<" + this.data + ">"
		// var node = document.doctype
		// return "<!DOCTYPE " + node.name +
		// 	(node.publicId ? ' PUBLIC "' + node.publicId + '"' : '') +
		// 	(!node.publicId && node.systemId ? ' SYSTEM' : '') +
		// 	(node.systemId ? ' "' + node.systemId + '"' : '') + '>'
	}
})

var registeredElements = {};

function Document() {
	this.childNodes = []
  makeEmitter(this);
	this.documentElement = this.createElement("html")
	this.appendChild(this.documentElement)
	this.body = this.createElement("body")
	this.documentElement.appendChild(this.body)
}

function own(Element) {
	return function($1, $2) {
		var node = new Element($1, $2)
		node.ownerDocument = this
		return node
	}
}

extendNode(Document, elementGetters, {
	nodeType: 9,
	nodeName: "#document",
	addEventListener: EventEmitter.prototype.addListener,
	on: EventEmitter.prototype.addListener,
	emit: EventEmitter.prototype.emit,
	registerElement: function (tagName, options) {
		registeredElements[tagName] = options;
		return options;
	},
	createElement: function (tagName) {
		var node;

		if (registeredElements[tagName]) {
			var options = registeredElements[tagName];
			node = Object.create(options.prototype);
			HTMLElement.call(node, tagName);
			node.createdCallback && node.createdCallback();
		} else {
			node = new HTMLElement(tagName);
		}

		node.ownerDocument = this;

		return node;
	},
	createElementNS: own(ElementNS),
	createTextNode: own(Text),
	createComment: own(Comment),
	createDocumentType: own(DocumentType), //Should be document.implementation.createDocumentType(name, publicId, systemId)
	createDocumentFragment: own(DocumentFragment)
})

module.exports = {
	document: new Document(),
	StyleMap: StyleMap,
	Node: Node,
	HTMLElement: HTMLElement,
	Document: Document,
	MutationObserver: MutationObserver
}

