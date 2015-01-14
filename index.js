/**
 * Module dependencies
 */

var Emitter = require('emitter');
var FileUpload = require('s3');
var MimeTypes = require('mime');
var IframeUpload = require('iframe-multipart');

/**
 * Expose 'Upload'
 */

module.exports = Upload;

/**
 * Upload a file to S3 with an iframe fallback
 *
 * @param {InputElement} input
 * @param {Object} opts
 * @param {Object} config
 */

function Upload(el, opts, config) {
  if (!(this instanceof Upload)) return new Upload(el, opts, config);

  this.el = el;
  opts = this.opts = opts || {};
  config = this.config = copy(config || opts.config || window.S3);

  var filename = el.value.replace(/^C:\\fakepath\\/i, '');
  this.filename = filename.replace(/[\(\)%\+#\'\"]/g, '');
  this.name = (opts.format ? opts.format : formatName)(config.prefix, this.filename);

  if (!opts.protocol) opts.protocol = window.location.protocol;
  this.bucketUrl = opts.protocol + '//' + config.bucket + '.s3.amazonaws.com';
  this.url = (config.cdn || this.bucketUrl) + '/' + this.name;
  if (opts.redirect) config.redirect = opts.redirect;

  // we don't have the file api
  if (!el.files) return this;

  window.S3 = config;
  opts.name = this.name;
  config.redirect = '';
  return wrapEnd(new FileUpload(el.files[0], opts), this.url);
}

/**
 * Mixin emitter.
 */

Emitter(Upload.prototype);

/**
 * Upload the file to s3 and invoke fn(err) when complete
 *
 * @param {Function} fn
 * @api public
 */

Upload.prototype.end = function(fn) {
  var el = this.el;
  var config = this.config;
  var format = this.opts.format || formatName;

  // create the hidden form
  var form = create('form', {
    'accept-charset': '',
    'enctype': 'multipart/form-data',
    method: 'POST',
    action: this.bucketUrl
  });

  // setup inputs with their values
  var inputs = {
    'key': this.name,
    'AWSAccessKeyId': config.key,
    'acl': config.acl,
    'success_action_redirect': config.redirect,
    'policy': config.policy,
    'signature': config.signature,
    'Content-Type': findMimeType(this.filename.split('.').pop()),
    'Content-Length': '1'
  };

  for (var k in inputs) {
    if (!inputs[k]) continue;
    var inp = create('input', {
      type: 'hidden',
      value: inputs[k],
      name: k
    });
    form.appendChild(inp);
  }

  var clone = el.cloneNode(false);
  el.parentNode.insertBefore(clone, el);

  // rename the file input
  var oldName = el.name;
  el.setAttribute('name', 'file');
  form.appendChild(el);

  var url = this.url;
  IframeUpload(form, {param: false}, function(err, res) {
    // reset the file input
    el.setAttribute('name', oldName);
    clone.parentNode.insertBefore(el, clone);
    clone.parentNode.removeChild(clone);

    if (err) return fn(err);
    fn(null, url, res);
  });
};

/**
 * Create an element with attributes
 *
 * @param {String} tag
 * @param {Object} attrs
 * @return {Element}
 */

function create(tag, attrs) {
  var elem = document.createElement(tag);
  for (var k in attrs) {
    elem.setAttribute(k, attrs[k]);
  }
  return elem;
}

/**
 * Format a filename to upload
 *
 * @param {String} key
 * @param {String} filename
 * @return {String}
 */

function formatName(key, filename) {
  return key + '-' + uid() + '-' + filename;
}

/**
 * Generate a uid
 *
 * @return {Number}
 */

function uid() {
  return Math.random() * 1e10 | 0;
}

/**
 * Find a mime type given an extension
 *
 * @param {String} extension
 * @return {String}
 */

function findMimeType(extension) {
  return MimeTypes.lookup(extension.toLowerCase()) || 'application/octet-stream';
}

/**
 * Wrap the component/s3 'end' function to return the url
 *
 * @param {Upload} upload
 * @param {String} url
 * @return {Upload}
 */

function wrapEnd(upload, url) {
  var end = upload.end;
  upload.end = function(fn) {
    end.call(this, function(err) {
      if (err) return fn(err);
      fn(err, url);
    });
  };
  return upload;
}

/**
 * Copy the obj so mutations don't happen upstream
 *
 * @param {Object} obj
 * @return {Object}
 */

function copy(obj) {
  return JSON.parse(JSON.stringify(obj));
}
