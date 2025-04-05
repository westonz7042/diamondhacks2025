/*
 * Copyright (c) 2010 Arc90 Inc
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *     http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

(function(global) {
  const REGEXPS = {
    // NOTE: These two regular expressions are duplicated in
    // Readability-readerable.js. Please keep both copies in sync.
    unlikelyCandidates: /-ad-|ai2html|banner|breadcrumbs|combx|comment|community|cover-wrap|disqus|extra|footer|gdpr|header|legends|menu|related|remark|replies|rss|shoutbox|sidebar|skyscraper|social|sponsor|supplemental|ad-break|agegate|pagination|pager|popup|yom-remote/i,
    okMaybeItsACandidate: /and|article|body|column|content|main|shadow/i,
  };

  class Readability {
    constructor(doc, options = {}) {
      this._doc = doc;
      this._options = options;
      this._articleTitle = null;
      this._articleContent = null;
    }

    parse() {
      // Clone the document so we don't modify the original
      const doc = this._doc.cloneNode(true);
      
      // Simplistic implementation
      let article = {
        title: this._getArticleTitle(doc),
        content: this._getArticleContent(doc),
        textContent: this._getArticleText(doc)
      };

      return article;
    }

    _getArticleTitle(doc) {
      // Try to get article title
      let title = doc.title || "";
      
      // Also look at h1 tags
      const h1 = doc.querySelector("h1");
      if (h1) {
        title = h1.textContent;
      }
      
      return title.trim();
    }

    _getArticleContent(doc) {
      // Basic implementation - get main elements that might contain the article
      const possibleElements = Array.from(doc.querySelectorAll("article, main, .main, .content, .article, #content, #main, [role='main']"));
      
      // Find the element with the most text content
      let bestElement = null;
      let maxTextLength = 0;
      
      for (const element of possibleElements) {
        const textLength = element.textContent.length;
        if (textLength > maxTextLength) {
          maxTextLength = textLength;
          bestElement = element;
        }
      }
      
      // If we found a good candidate, use it, otherwise use the body
      if (bestElement && maxTextLength > 500) {
        return bestElement;
      } else {
        return doc.body;
      }
    }

    _getArticleText(doc) {
      const content = this._getArticleContent(doc);
      
      // Remove scripts, styles, etc.
      const scripts = content.querySelectorAll("script, style, svg, img, video");
      for (const script of Array.from(scripts)) {
        script.remove();
      }
      
      // Get text content
      return content.textContent.trim()
        .replace(/[\s\t]+/g, " ")
        .replace(/\n\s*/g, "\n");
    }
  }

  // Expose Readability to the global object
  global.Readability = Readability;
})(this);