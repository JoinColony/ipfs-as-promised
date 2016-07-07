'use strict';

Object.defineProperty(exports, "__esModule", {
  value: true
});

var _regenerator = require('babel-runtime/regenerator');

var _regenerator2 = _interopRequireDefault(_regenerator);

var _asyncToGenerator2 = require('babel-runtime/helpers/asyncToGenerator');

var _asyncToGenerator3 = _interopRequireDefault(_asyncToGenerator2);

var _promise = require('babel-runtime/core-js/promise');

var _promise2 = _interopRequireDefault(_promise);

var _classCallCheck2 = require('babel-runtime/helpers/classCallCheck');

var _classCallCheck3 = _interopRequireDefault(_classCallCheck2);

var _createClass2 = require('babel-runtime/helpers/createClass');

var _createClass3 = _interopRequireDefault(_createClass2);

var _ipfsApi = require('ipfs-api');

var _ipfsApi2 = _interopRequireDefault(_ipfsApi);

var _isIpfs = require('is-ipfs');

var _isIpfs2 = _interopRequireDefault(_isIpfs);

var _ejson = require('ejson');

var _ejson2 = _interopRequireDefault(_ejson);

var _buffer = require('buffer');

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

var IpfsClient = function () {
  function IpfsClient(opts) {
    (0, _classCallCheck3.default)(this, IpfsClient);

    opts = opts || {};
    this._address = opts.address || '/ip4/127.0.0.1/tcp/5001';
    this._ipfs = (0, _ipfsApi2.default)(this._address);
  }

  (0, _createClass3.default)(IpfsClient, [{
    key: 'ipfsCat',
    value: function ipfsCat(hash) {
      var _this = this;

      return new _promise2.default(function (resolve, reject) {
        var currentChunk = new _buffer.Buffer(0);
        _this._ipfs.cat(hash, function (err, data) {
          if (err) {
            return reject(err);
          }
          if (data && data.readable) {
            data.on('data', function (chunk) {
              // If we execute on the server, chunk is a buffer
              // If we execute on the client, chunk is a string
              // We can't Buffer.concat strings
              // A cookie for anyone who can work out what's happening here
              // Unfortunately, it might be because of meteor-node-stubs which would be
              // quite the knot to untangle.
              if (typeof chunk === 'string') {
                chunk = new _buffer.Buffer(chunk);
              }
              currentChunk = _buffer.Buffer.concat([currentChunk, chunk]);
            });
            data.on('end', function () {
              resolve(currentChunk.toString());
            });
            data.on('error', function (err) {
              reject(err);
            });
          }
        });
      });
    }
  }, {
    key: 'ipfsAdd',
    value: function ipfsAdd(content) {
      var _this2 = this;

      if (_ejson2.default.isBinary(content) && content.buffer) {
        content = new _buffer.Buffer(new Uint8Array(content.buffer));
      } else {
        content = new _buffer.Buffer(content);
      }
      return new _promise2.default(function (resolve, reject) {
        _this2._ipfs.add(content, function (err, data) {
          if (err) {
            reject(err);
          } else {
            resolve(data[0].Hash);
          }
        });
      });
    }
  }, {
    key: 'ipnsPublish',
    value: function ipnsPublish(hash) {
      var _this3 = this;

      this._ipnsTarget = '/ipfs/' + hash;
      return new _promise2.default(function (resolve, reject) {
        _this3._ipfs.name.publish(hash, function (err, data) {
          if (err) {
            reject(new Error(err.Message));
          } else {
            resolve(data);
          }
        });
      });
    }
  }, {
    key: 'ipfsPatchAddLink',
    value: function ipfsPatchAddLink(root, name, ref) {
      var _this4 = this;

      return new _promise2.default(function (resolve, reject) {
        _this4._ipfs.object.patch.addLink(root, name, ref, function (err, data) {
          if (err) {
            reject(new Error(err.Message));
          } else {
            resolve(data.Hash);
          }
        });
      });
    }
  }, {
    key: 'ipfsPatchRmLink',
    value: function ipfsPatchRmLink(root, link) {
      var _this5 = this;

      return new _promise2.default(function (resolve, reject) {
        _this5._ipfs.object.patch.rmLink(root, link, function (err, data) {
          if (err) {
            reject(new Error(err.Message));
          } else {
            resolve(data.Hash);
          }
        });
      });
    }
  }, {
    key: 'ipfsls',
    value: function () {
      var _ref = (0, _asyncToGenerator3.default)(_regenerator2.default.mark(function _callee(path) {
        var _this6 = this;

        var ipfsid;
        return _regenerator2.default.wrap(function _callee$(_context) {
          while (1) {
            switch (_context.prev = _context.next) {
              case 0:
                _context.next = 2;
                return this.ipfsid();

              case 2:
                ipfsid = _context.sent;

                if (path.startsWith('/ipns/' + ipfsid)) {
                  if (this._ipnsTarget) {
                    path = path.replace('/ipns/' + ipfsid, this._ipnsTarget);
                  } else {
                    this.ipfsNameResolve('/ipns/' + ipfsid);
                  }
                }
                return _context.abrupt('return', new _promise2.default(function (resolve, reject) {
                  _this6._ipfs.ls(path, function (err, data) {
                    if (err) {
                      reject(new Error(err.Message));
                    } else {
                      resolve(data);
                    }
                  });
                }));

              case 5:
              case 'end':
                return _context.stop();
            }
          }
        }, _callee, this);
      }));

      function ipfsls(_x) {
        return _ref.apply(this, arguments);
      }

      return ipfsls;
    }()
    /**
     * Resolve an IPNS name to an IPFS hash
     * @method ipfsNameResolve
     * @param  {string}        name IPNS name
     * @return {string}             IPFS hash
     */

  }, {
    key: 'ipfsNameResolve',
    value: function () {
      var _ref2 = (0, _asyncToGenerator3.default)(_regenerator2.default.mark(function _callee2(name) {
        var _this7 = this;

        var ipfsid;
        return _regenerator2.default.wrap(function _callee2$(_context2) {
          while (1) {
            switch (_context2.prev = _context2.next) {
              case 0:
                _context2.next = 2;
                return this.ipfsid();

              case 2:
                ipfsid = _context2.sent;

                if (!(name.startsWith('/ipns/' + ipfsid) && this._ipnsTarget)) {
                  _context2.next = 6;
                  break;
                }

                name = name.replace('/ipns/' + ipfsid, this._ipnsTarget);
                return _context2.abrupt('return', { Path: name });

              case 6:
                return _context2.abrupt('return', new _promise2.default(function (resolve, reject) {
                  _this7._ipfs.name.resolve(name, function (err, data) {
                    if (err) {
                      reject(new Error(err.Message));
                    } else {
                      if (name === '/ipns/' + ipfsid) {
                        _this7._ipnsTarget = data.Path;
                      }
                      resolve(data);
                    }
                  });
                }));

              case 7:
              case 'end':
                return _context2.stop();
            }
          }
        }, _callee2, this);
      }));

      function ipfsNameResolve(_x2) {
        return _ref2.apply(this, arguments);
      }

      return ipfsNameResolve;
    }()
  }, {
    key: 'ipfsid',
    value: function ipfsid() {
      var _this8 = this;

      return new _promise2.default(function (resolve, reject) {
        _this8._ipfs.id(function (err, data) {
          if (err) {
            reject(new Error(err.Message));
          } else {
            resolve(data.ID);
          }
        });
      });
    }
    /**
     * Takes an IPFS/IPNS path and returns an object hash
     * @method
     * @param  {string} path IPNS/IPFS path
     * @return {string}      Hash of that object
     */

  }, {
    key: 'resolvePath',
    value: function () {
      var _ref3 = (0, _asyncToGenerator3.default)(_regenerator2.default.mark(function _callee3(path) {
        var resolved, res;
        return _regenerator2.default.wrap(function _callee3$(_context3) {
          while (1) {
            switch (_context3.prev = _context3.next) {
              case 0:
                if (_isIpfs2.default.path(path)) {
                  _context3.next = 2;
                  break;
                }

                throw new Error('Not an ipfs path');

              case 2:
                // strip off the last slash if it exists
                if (path.slice(-1) === '/') {
                  path = path.slice(0, path.length - 1);
                }
                // If the path is /ipns/, then resolve it

                if (!(path.slice(0, 6) === '/ipns/')) {
                  _context3.next = 8;
                  break;
                }

                _context3.next = 6;
                return this.ipfsNameResolve(path);

              case 6:
                resolved = _context3.sent;

                path = resolved.Path;

              case 8:
                if (!((path.match(/\//g) || []).length === 2 && path.slice(0, 6) === '/ipfs/')) {
                  _context3.next = 12;
                  break;
                }

                return _context3.abrupt('return', path.slice(6));

              case 12:
                _context3.next = 14;
                return this.ipfsls(path.slice(0, path.lastIndexOf('/')));

              case 14:
                res = _context3.sent;
                return _context3.abrupt('return', res.Objects[0].Links.filter(function (element) {
                  return !!(element.Name === path.slice(path.lastIndexOf('/') + 1));
                })[0].Hash);

              case 16:
              case 'end':
                return _context3.stop();
            }
          }
        }, _callee3, this);
      }));

      function resolvePath(_x3) {
        return _ref3.apply(this, arguments);
      }

      return resolvePath;
    }()
  }]);
  return IpfsClient;
}();

exports.default = IpfsClient;