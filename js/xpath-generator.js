window.XPathGenerator = (function() {
    'use strict';

    function containsChinese(text) {
        return /[一-龥]/.test(text);
    }

    function isLikelyAutoId(idValue) {
        if (!idValue) return false;
        if (/^(u_|g_|ember-|react-select-|vs\d+_)/i.test(idValue)) return true;
        if ((/[A-Za-z]/.test(idValue) && /\d{2,}/.test(idValue) && idValue.length >= 10) ||
            /[_-]\d{4,}$/.test(idValue) ||
            /^[a-f0-9]{8,}$/i.test(idValue)) {
            return true;
        }
        return false;
    }

    function isHashyClassToken(token) {
        if (!token) return false;
        const hasLetters = /[A-Za-z]/.test(token);
        const hasDigits = /\d/.test(token);
        const longEnough = token.length >= 6;
        const hasWordLike = /[A-Za-z]{3,}/.test(token);
        return hasLetters && hasDigits && longEnough && !hasWordLike;
    }

    function pickStableDataOrAriaAttribute(element) {
        if (!element || !element.attributes) return null;
        const preferredOrder = ['data-', 'aria-', 'role'];
        for (const prefix of preferredOrder) {
            for (const attr of Array.from(element.attributes)) {
                const name = attr.name;
                const value = attr.value;
                if (!value) continue;
                if (prefix === 'role' ? name === 'role' : name.startsWith(prefix)) {
                    if (!(containsChinese(value) && value.trim().length <= 4)) {
                        return { name, value };
                    }
                }
            }
        }
        return null;
    }

    function pickStableClassToken(className) {
        if (!className || typeof className !== 'string') return null;
        const tokens = className.trim().split(/\s+/);
        for (const token of tokens) {
            if (containsChinese(token)) continue;
            if (isHashyClassToken(token)) continue;
            if (token.length >= 3) return token;
        }
        return null;
    }

    function getStableCssSelector(element) {
        if (!element || element === document.body) return 'body';
        const tag = element.tagName.toLowerCase();

        const stableAttr = pickStableDataOrAriaAttribute(element);
        if (stableAttr) {
            return `${tag}[${stableAttr.name}="${stableAttr.value}"]`;
        }

        if (element.id && !isLikelyAutoId(element.id) && !containsChinese(element.id)) {
            return `#${CSS.escape(element.id)}`;
        }

        if (element.className && typeof element.className === 'string') {
            const token = pickStableClassToken(element.className);
            if (token) {
                const sel = `${tag}.${CSS.escape(token)}`;
                try {
                    if (document.querySelectorAll(sel).length <= 10) return sel;
                } catch (e) {}
            }
        }

        const semanticAttrs = ['name', 'type', 'title', 'placeholder'];
        for (const attr of semanticAttrs) {
            if (element.hasAttribute(attr)) {
                const val = element.getAttribute(attr);
                if (val && !containsChinese(val)) {
                    return `${tag}[${attr}="${val}"]`;
                }
            }
        }

        const parent = element.parentElement;
        if (parent) {
            const siblings = Array.from(parent.children).filter(el => el.tagName === element.tagName);
            if (siblings.length === 1) {
                return `${getStableCssSelector(parent)} > ${tag}`;
            }
            const idx = siblings.indexOf(element) + 1;
            return `${getStableCssSelector(parent)} > ${tag}:nth-of-type(${idx})`;
        }

        return tag;
    }

    function getPreciseXPath(element) {
        if (!element || element === document.body) return '/html/body';

        const tagName = element.tagName.toLowerCase();

        const stableDataAttr = pickStableDataOrAriaAttribute(element);
        if (stableDataAttr) {
            return `//${tagName}[@${stableDataAttr.name}="${stableDataAttr.value}"]`;
        }

        if (element.id && !isLikelyAutoId(element.id) && !containsChinese(element.id)) {
            return `//${tagName}[@id="${element.id}"]`;
        }

        const simpleXPath = `//${tagName}`;
        try {
            const matchedNodes = document.evaluate(simpleXPath, document, null, XPathResult.ORDERED_NODE_SNAPSHOT_TYPE, null);
            const matchCount = matchedNodes.snapshotLength;
            if (matchCount <= 10) {
                if (matchCount === 1) {
                    return simpleXPath;
                } else {
                    for (let i = 0; i < matchCount; i++) {
                        if (matchedNodes.snapshotItem(i) === element) {
                            return `(${simpleXPath})[${i + 1}]`;
                        }
                    }
                }
            }
        } catch (e) {}

        if (element.className && typeof element.className === 'string' && element.className.trim()) {
            const stableToken = pickStableClassToken(element.className);
            if (stableToken) {
                return `//${tagName}[contains(@class, "${stableToken}")]`;
            }
        }

        const semanticAttributes = ['name', 'type', 'title', 'alt', 'placeholder', 'for'];
        for (const attr of semanticAttributes) {
            if (element.hasAttribute(attr)) {
                const value = element.getAttribute(attr);
                if (value && !containsChinese(value)) {
                    return `//${tagName}[@${attr}="${value}"]`;
                }
            }
        }

        const siblings = element.parentNode ? element.parentNode.children : [];
        let index = 1;
        for (let i = 0; i < siblings.length; i++) {
            const sibling = siblings[i];
            if (sibling === element) {
                return `${getPreciseXPath(element.parentNode)}/${tagName}[${index}]`;
            }
            if (sibling.nodeType === 1 && sibling.tagName === element.tagName) {
                index++;
            }
        }

        return getPreciseXPath(element.parentNode) + '/' + tagName;
    }

    function getContainsXPath(element) {
        if (!element || element === document.body) return '/html/body';

        const tagName = element.tagName.toLowerCase();

        if (element.id) {
            const idBase = element.id.replace(/\d+$/, '');
            if (idBase !== element.id) {
                const cleanIdBase = idBase.replace(/[_-]+$/, '');
                return `//${tagName}[contains(@id, "${cleanIdBase}")]`;
            }
            return `//${tagName}[@id="${element.id}"]`;
        }

        if (element.className && typeof element.className === 'string' && element.className.trim()) {
            const classes = element.className.trim().split(/\s+/);
            for (const cls of classes) {
                const matches = cls.match(/^([a-zA-Z_-]+)[a-zA-Z0-9_-]*$/);
                if (matches && matches[1].length >= 2) {
                    const prefix = matches[1];
                    return `//${tagName}[contains(@class, "${prefix}")]`;
                }
            }
            if (classes.length > 0) {
                return `//${tagName}[contains(@class, "${classes[0]}")]`;
            }
        }

        const usefulAttributes = ['name', 'href', 'src', 'alt', 'title', 'value', 'data-testid', 'data-id'];
        for (const attr of usefulAttributes) {
            if (element.hasAttribute(attr)) {
                const value = element.getAttribute(attr);
                if (value.length > 5) {
                    const partialValue = value.substring(0, Math.min(10, value.length));
                    return `//${tagName}[contains(@${attr}, "${partialValue}")]`;
                } else {
                    return `//${tagName}[@${attr}="${value}"]`;
                }
            }
        }

        return getPreciseXPath(element);
    }

    function getPositionXPath(element) {
        if (!element || element === document.body) return '/html/body';

        const tagName = element.tagName.toLowerCase();

        const simpleXPath = `//${tagName}`;
        try {
            const matchedNodes = document.evaluate(simpleXPath, document, null, XPathResult.ORDERED_NODE_SNAPSHOT_TYPE, null);
            if (matchedNodes.snapshotLength > 0) {
                return simpleXPath;
            }
        } catch(e) {}

        if (element.id) {
            return `//${tagName}[@id="${element.id}"]`;
        }

        if (element.className && typeof element.className === 'string' && element.className.trim()) {
            const fullClass = element.className;
            return `//${tagName}[@class="${fullClass}"]`;
        }

        const usefulAttributes = ['name', 'href', 'src', 'alt', 'title', 'value', 'data-testid', 'data-id'];
        for (const attr of usefulAttributes) {
            if (element.hasAttribute(attr)) {
                return `//${tagName}[@${attr}="${element.getAttribute(attr)}"]`;
            }
        }

        const siblings = element.parentNode ? element.parentNode.children : [];
        let index = 1;
        for (let i = 0; i < siblings.length; i++) {
            const sibling = siblings[i];
            if (sibling === element) {
                return `//${tagName}[${index}]`;
            }
            if (sibling.nodeType === 1 && sibling.tagName === element.tagName) {
                index++;
            }
        }

        return `//${tagName}`;
    }

    function getXPathByMode(element, mode) {
        switch(mode) {
            case 'contains':
                return getContainsXPath(element);
            case 'position':
                return getPositionXPath(element);
            case 'precise':
            default:
                return getPreciseXPath(element);
        }
    }

    function getPositionedXPath(element, matchedElements, mode) {
        if (!element || !matchedElements.length) {
            return getXPathByMode(element, mode);
        }

        const position = matchedElements.indexOf(element) + 1;
        if (position === 0) {
            return getXPathByMode(element, mode);
        }

        const baseXPath = getXPathByMode(element, mode);
        return `(${baseXPath})[${position}]`;
    }

    return {
        getPreciseXPath: getPreciseXPath,
        getContainsXPath: getContainsXPath,
        getPositionXPath: getPositionXPath,
        getXPathByMode: getXPathByMode,
        getPositionedXPath: getPositionedXPath,
        getStableCssSelector: getStableCssSelector
    };
})();