var __create = Object.create;
var __defProp = Object.defineProperty;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __getProtoOf = Object.getPrototypeOf;
var __hasOwnProp = Object.prototype.hasOwnProperty;
var __require = /* @__PURE__ */ ((x) => typeof require !== "undefined" ? require : typeof Proxy !== "undefined" ? new Proxy(x, {
  get: (a, b) => (typeof require !== "undefined" ? require : a)[b]
}) : x)(function(x) {
  if (typeof require !== "undefined") return require.apply(this, arguments);
  throw Error('Dynamic require of "' + x + '" is not supported');
});
var __commonJS = (cb, mod) => function __require2() {
  try {
    return mod || (0, cb[__getOwnPropNames(cb)[0]])((mod = { exports: {} }).exports, mod), mod.exports;
  } catch (e) {
    throw mod = 0, e;
  }
};
var __copyProps = (to, from, except, desc) => {
  if (from && typeof from === "object" || typeof from === "function") {
    for (let key of __getOwnPropNames(from))
      if (!__hasOwnProp.call(to, key) && key !== except)
        __defProp(to, key, { get: () => from[key], enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable });
  }
  return to;
};
var __toESM = (mod, isNodeMode, target) => (target = mod != null ? __create(__getProtoOf(mod)) : {}, __copyProps(
  // If the importer is in node compatibility mode or this is not an ESM
  // file that has been converted to a CommonJS file using a Babel-
  // compatible transform (i.e. "__esModule" has not been set), then set
  // "default" to the CommonJS "module.exports" for node compatibility.
  isNodeMode || !mod || !mod.__esModule ? __defProp(target, "default", { value: mod, enumerable: true }) : target,
  mod
));

// node_modules/jszip/dist/jszip.min.js
var require_jszip_min = __commonJS({
  "node_modules/jszip/dist/jszip.min.js"(exports, module) {
    !(function(e) {
      if ("object" == typeof exports && "undefined" != typeof module) module.exports = e();
      else if ("function" == typeof define && define.amd) define([], e);
      else {
        ("undefined" != typeof window ? window : "undefined" != typeof global ? global : "undefined" != typeof self ? self : this).JSZip = e();
      }
    })(function() {
      return (function s(a, o, h) {
        function u(r, e2) {
          if (!o[r]) {
            if (!a[r]) {
              var t = "function" == typeof __require && __require;
              if (!e2 && t) return t(r, true);
              if (l) return l(r, true);
              var n = new Error("Cannot find module '" + r + "'");
              throw n.code = "MODULE_NOT_FOUND", n;
            }
            var i = o[r] = { exports: {} };
            a[r][0].call(i.exports, function(e3) {
              var t2 = a[r][1][e3];
              return u(t2 || e3);
            }, i, i.exports, s, a, o, h);
          }
          return o[r].exports;
        }
        for (var l = "function" == typeof __require && __require, e = 0; e < h.length; e++) u(h[e]);
        return u;
      })({ 1: [function(e, t, r) {
        "use strict";
        var d = e("./utils"), c = e("./support"), p = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/=";
        r.encode = function(e2) {
          for (var t2, r2, n, i, s, a, o, h = [], u = 0, l = e2.length, f = l, c2 = "string" !== d.getTypeOf(e2); u < e2.length; ) f = l - u, n = c2 ? (t2 = e2[u++], r2 = u < l ? e2[u++] : 0, u < l ? e2[u++] : 0) : (t2 = e2.charCodeAt(u++), r2 = u < l ? e2.charCodeAt(u++) : 0, u < l ? e2.charCodeAt(u++) : 0), i = t2 >> 2, s = (3 & t2) << 4 | r2 >> 4, a = 1 < f ? (15 & r2) << 2 | n >> 6 : 64, o = 2 < f ? 63 & n : 64, h.push(p.charAt(i) + p.charAt(s) + p.charAt(a) + p.charAt(o));
          return h.join("");
        }, r.decode = function(e2) {
          var t2, r2, n, i, s, a, o = 0, h = 0, u = "data:";
          if (e2.substr(0, u.length) === u) throw new Error("Invalid base64 input, it looks like a data url.");
          var l, f = 3 * (e2 = e2.replace(/[^A-Za-z0-9+/=]/g, "")).length / 4;
          if (e2.charAt(e2.length - 1) === p.charAt(64) && f--, e2.charAt(e2.length - 2) === p.charAt(64) && f--, f % 1 != 0) throw new Error("Invalid base64 input, bad content length.");
          for (l = c.uint8array ? new Uint8Array(0 | f) : new Array(0 | f); o < e2.length; ) t2 = p.indexOf(e2.charAt(o++)) << 2 | (i = p.indexOf(e2.charAt(o++))) >> 4, r2 = (15 & i) << 4 | (s = p.indexOf(e2.charAt(o++))) >> 2, n = (3 & s) << 6 | (a = p.indexOf(e2.charAt(o++))), l[h++] = t2, 64 !== s && (l[h++] = r2), 64 !== a && (l[h++] = n);
          return l;
        };
      }, { "./support": 30, "./utils": 32 }], 2: [function(e, t, r) {
        "use strict";
        var n = e("./external"), i = e("./stream/DataWorker"), s = e("./stream/Crc32Probe"), a = e("./stream/DataLengthProbe");
        function o(e2, t2, r2, n2, i2) {
          this.compressedSize = e2, this.uncompressedSize = t2, this.crc32 = r2, this.compression = n2, this.compressedContent = i2;
        }
        o.prototype = { getContentWorker: function() {
          var e2 = new i(n.Promise.resolve(this.compressedContent)).pipe(this.compression.uncompressWorker()).pipe(new a("data_length")), t2 = this;
          return e2.on("end", function() {
            if (this.streamInfo.data_length !== t2.uncompressedSize) throw new Error("Bug : uncompressed data size mismatch");
          }), e2;
        }, getCompressedWorker: function() {
          return new i(n.Promise.resolve(this.compressedContent)).withStreamInfo("compressedSize", this.compressedSize).withStreamInfo("uncompressedSize", this.uncompressedSize).withStreamInfo("crc32", this.crc32).withStreamInfo("compression", this.compression);
        } }, o.createWorkerFrom = function(e2, t2, r2) {
          return e2.pipe(new s()).pipe(new a("uncompressedSize")).pipe(t2.compressWorker(r2)).pipe(new a("compressedSize")).withStreamInfo("compression", t2);
        }, t.exports = o;
      }, { "./external": 6, "./stream/Crc32Probe": 25, "./stream/DataLengthProbe": 26, "./stream/DataWorker": 27 }], 3: [function(e, t, r) {
        "use strict";
        var n = e("./stream/GenericWorker");
        r.STORE = { magic: "\0\0", compressWorker: function() {
          return new n("STORE compression");
        }, uncompressWorker: function() {
          return new n("STORE decompression");
        } }, r.DEFLATE = e("./flate");
      }, { "./flate": 7, "./stream/GenericWorker": 28 }], 4: [function(e, t, r) {
        "use strict";
        var n = e("./utils");
        var o = (function() {
          for (var e2, t2 = [], r2 = 0; r2 < 256; r2++) {
            e2 = r2;
            for (var n2 = 0; n2 < 8; n2++) e2 = 1 & e2 ? 3988292384 ^ e2 >>> 1 : e2 >>> 1;
            t2[r2] = e2;
          }
          return t2;
        })();
        t.exports = function(e2, t2) {
          return void 0 !== e2 && e2.length ? "string" !== n.getTypeOf(e2) ? (function(e3, t3, r2, n2) {
            var i = o, s = n2 + r2;
            e3 ^= -1;
            for (var a = n2; a < s; a++) e3 = e3 >>> 8 ^ i[255 & (e3 ^ t3[a])];
            return -1 ^ e3;
          })(0 | t2, e2, e2.length, 0) : (function(e3, t3, r2, n2) {
            var i = o, s = n2 + r2;
            e3 ^= -1;
            for (var a = n2; a < s; a++) e3 = e3 >>> 8 ^ i[255 & (e3 ^ t3.charCodeAt(a))];
            return -1 ^ e3;
          })(0 | t2, e2, e2.length, 0) : 0;
        };
      }, { "./utils": 32 }], 5: [function(e, t, r) {
        "use strict";
        r.base64 = false, r.binary = false, r.dir = false, r.createFolders = true, r.date = null, r.compression = null, r.compressionOptions = null, r.comment = null, r.unixPermissions = null, r.dosPermissions = null;
      }, {}], 6: [function(e, t, r) {
        "use strict";
        var n = null;
        n = "undefined" != typeof Promise ? Promise : e("lie"), t.exports = { Promise: n };
      }, { lie: 37 }], 7: [function(e, t, r) {
        "use strict";
        var n = "undefined" != typeof Uint8Array && "undefined" != typeof Uint16Array && "undefined" != typeof Uint32Array, i = e("pako"), s = e("./utils"), a = e("./stream/GenericWorker"), o = n ? "uint8array" : "array";
        function h(e2, t2) {
          a.call(this, "FlateWorker/" + e2), this._pako = null, this._pakoAction = e2, this._pakoOptions = t2, this.meta = {};
        }
        r.magic = "\b\0", s.inherits(h, a), h.prototype.processChunk = function(e2) {
          this.meta = e2.meta, null === this._pako && this._createPako(), this._pako.push(s.transformTo(o, e2.data), false);
        }, h.prototype.flush = function() {
          a.prototype.flush.call(this), null === this._pako && this._createPako(), this._pako.push([], true);
        }, h.prototype.cleanUp = function() {
          a.prototype.cleanUp.call(this), this._pako = null;
        }, h.prototype._createPako = function() {
          this._pako = new i[this._pakoAction]({ raw: true, level: this._pakoOptions.level || -1 });
          var t2 = this;
          this._pako.onData = function(e2) {
            t2.push({ data: e2, meta: t2.meta });
          };
        }, r.compressWorker = function(e2) {
          return new h("Deflate", e2);
        }, r.uncompressWorker = function() {
          return new h("Inflate", {});
        };
      }, { "./stream/GenericWorker": 28, "./utils": 32, pako: 38 }], 8: [function(e, t, r) {
        "use strict";
        function A(e2, t2) {
          var r2, n2 = "";
          for (r2 = 0; r2 < t2; r2++) n2 += String.fromCharCode(255 & e2), e2 >>>= 8;
          return n2;
        }
        function n(e2, t2, r2, n2, i2, s2) {
          var a, o, h = e2.file, u = e2.compression, l = s2 !== O.utf8encode, f = I.transformTo("string", s2(h.name)), c = I.transformTo("string", O.utf8encode(h.name)), d = h.comment, p = I.transformTo("string", s2(d)), m = I.transformTo("string", O.utf8encode(d)), _ = c.length !== h.name.length, g = m.length !== d.length, b = "", v = "", y = "", w = h.dir, k = h.date, x = { crc32: 0, compressedSize: 0, uncompressedSize: 0 };
          t2 && !r2 || (x.crc32 = e2.crc32, x.compressedSize = e2.compressedSize, x.uncompressedSize = e2.uncompressedSize);
          var S = 0;
          t2 && (S |= 8), l || !_ && !g || (S |= 2048);
          var z = 0, C = 0;
          w && (z |= 16), "UNIX" === i2 ? (C = 798, z |= (function(e3, t3) {
            var r3 = e3;
            return e3 || (r3 = t3 ? 16893 : 33204), (65535 & r3) << 16;
          })(h.unixPermissions, w)) : (C = 20, z |= (function(e3) {
            return 63 & (e3 || 0);
          })(h.dosPermissions)), a = k.getUTCHours(), a <<= 6, a |= k.getUTCMinutes(), a <<= 5, a |= k.getUTCSeconds() / 2, o = k.getUTCFullYear() - 1980, o <<= 4, o |= k.getUTCMonth() + 1, o <<= 5, o |= k.getUTCDate(), _ && (v = A(1, 1) + A(B(f), 4) + c, b += "up" + A(v.length, 2) + v), g && (y = A(1, 1) + A(B(p), 4) + m, b += "uc" + A(y.length, 2) + y);
          var E = "";
          return E += "\n\0", E += A(S, 2), E += u.magic, E += A(a, 2), E += A(o, 2), E += A(x.crc32, 4), E += A(x.compressedSize, 4), E += A(x.uncompressedSize, 4), E += A(f.length, 2), E += A(b.length, 2), { fileRecord: R.LOCAL_FILE_HEADER + E + f + b, dirRecord: R.CENTRAL_FILE_HEADER + A(C, 2) + E + A(p.length, 2) + "\0\0\0\0" + A(z, 4) + A(n2, 4) + f + b + p };
        }
        var I = e("../utils"), i = e("../stream/GenericWorker"), O = e("../utf8"), B = e("../crc32"), R = e("../signature");
        function s(e2, t2, r2, n2) {
          i.call(this, "ZipFileWorker"), this.bytesWritten = 0, this.zipComment = t2, this.zipPlatform = r2, this.encodeFileName = n2, this.streamFiles = e2, this.accumulate = false, this.contentBuffer = [], this.dirRecords = [], this.currentSourceOffset = 0, this.entriesCount = 0, this.currentFile = null, this._sources = [];
        }
        I.inherits(s, i), s.prototype.push = function(e2) {
          var t2 = e2.meta.percent || 0, r2 = this.entriesCount, n2 = this._sources.length;
          this.accumulate ? this.contentBuffer.push(e2) : (this.bytesWritten += e2.data.length, i.prototype.push.call(this, { data: e2.data, meta: { currentFile: this.currentFile, percent: r2 ? (t2 + 100 * (r2 - n2 - 1)) / r2 : 100 } }));
        }, s.prototype.openedSource = function(e2) {
          this.currentSourceOffset = this.bytesWritten, this.currentFile = e2.file.name;
          var t2 = this.streamFiles && !e2.file.dir;
          if (t2) {
            var r2 = n(e2, t2, false, this.currentSourceOffset, this.zipPlatform, this.encodeFileName);
            this.push({ data: r2.fileRecord, meta: { percent: 0 } });
          } else this.accumulate = true;
        }, s.prototype.closedSource = function(e2) {
          this.accumulate = false;
          var t2 = this.streamFiles && !e2.file.dir, r2 = n(e2, t2, true, this.currentSourceOffset, this.zipPlatform, this.encodeFileName);
          if (this.dirRecords.push(r2.dirRecord), t2) this.push({ data: (function(e3) {
            return R.DATA_DESCRIPTOR + A(e3.crc32, 4) + A(e3.compressedSize, 4) + A(e3.uncompressedSize, 4);
          })(e2), meta: { percent: 100 } });
          else for (this.push({ data: r2.fileRecord, meta: { percent: 0 } }); this.contentBuffer.length; ) this.push(this.contentBuffer.shift());
          this.currentFile = null;
        }, s.prototype.flush = function() {
          for (var e2 = this.bytesWritten, t2 = 0; t2 < this.dirRecords.length; t2++) this.push({ data: this.dirRecords[t2], meta: { percent: 100 } });
          var r2 = this.bytesWritten - e2, n2 = (function(e3, t3, r3, n3, i2) {
            var s2 = I.transformTo("string", i2(n3));
            return R.CENTRAL_DIRECTORY_END + "\0\0\0\0" + A(e3, 2) + A(e3, 2) + A(t3, 4) + A(r3, 4) + A(s2.length, 2) + s2;
          })(this.dirRecords.length, r2, e2, this.zipComment, this.encodeFileName);
          this.push({ data: n2, meta: { percent: 100 } });
        }, s.prototype.prepareNextSource = function() {
          this.previous = this._sources.shift(), this.openedSource(this.previous.streamInfo), this.isPaused ? this.previous.pause() : this.previous.resume();
        }, s.prototype.registerPrevious = function(e2) {
          this._sources.push(e2);
          var t2 = this;
          return e2.on("data", function(e3) {
            t2.processChunk(e3);
          }), e2.on("end", function() {
            t2.closedSource(t2.previous.streamInfo), t2._sources.length ? t2.prepareNextSource() : t2.end();
          }), e2.on("error", function(e3) {
            t2.error(e3);
          }), this;
        }, s.prototype.resume = function() {
          return !!i.prototype.resume.call(this) && (!this.previous && this._sources.length ? (this.prepareNextSource(), true) : this.previous || this._sources.length || this.generatedError ? void 0 : (this.end(), true));
        }, s.prototype.error = function(e2) {
          var t2 = this._sources;
          if (!i.prototype.error.call(this, e2)) return false;
          for (var r2 = 0; r2 < t2.length; r2++) try {
            t2[r2].error(e2);
          } catch (e3) {
          }
          return true;
        }, s.prototype.lock = function() {
          i.prototype.lock.call(this);
          for (var e2 = this._sources, t2 = 0; t2 < e2.length; t2++) e2[t2].lock();
        }, t.exports = s;
      }, { "../crc32": 4, "../signature": 23, "../stream/GenericWorker": 28, "../utf8": 31, "../utils": 32 }], 9: [function(e, t, r) {
        "use strict";
        var u = e("../compressions"), n = e("./ZipFileWorker");
        r.generateWorker = function(e2, a, t2) {
          var o = new n(a.streamFiles, t2, a.platform, a.encodeFileName), h = 0;
          try {
            e2.forEach(function(e3, t3) {
              h++;
              var r2 = (function(e4, t4) {
                var r3 = e4 || t4, n3 = u[r3];
                if (!n3) throw new Error(r3 + " is not a valid compression method !");
                return n3;
              })(t3.options.compression, a.compression), n2 = t3.options.compressionOptions || a.compressionOptions || {}, i = t3.dir, s = t3.date;
              t3._compressWorker(r2, n2).withStreamInfo("file", { name: e3, dir: i, date: s, comment: t3.comment || "", unixPermissions: t3.unixPermissions, dosPermissions: t3.dosPermissions }).pipe(o);
            }), o.entriesCount = h;
          } catch (e3) {
            o.error(e3);
          }
          return o;
        };
      }, { "../compressions": 3, "./ZipFileWorker": 8 }], 10: [function(e, t, r) {
        "use strict";
        function n() {
          if (!(this instanceof n)) return new n();
          if (arguments.length) throw new Error("The constructor with parameters has been removed in JSZip 3.0, please check the upgrade guide.");
          this.files = /* @__PURE__ */ Object.create(null), this.comment = null, this.root = "", this.clone = function() {
            var e2 = new n();
            for (var t2 in this) "function" != typeof this[t2] && (e2[t2] = this[t2]);
            return e2;
          };
        }
        (n.prototype = e("./object")).loadAsync = e("./load"), n.support = e("./support"), n.defaults = e("./defaults"), n.version = "3.10.1", n.loadAsync = function(e2, t2) {
          return new n().loadAsync(e2, t2);
        }, n.external = e("./external"), t.exports = n;
      }, { "./defaults": 5, "./external": 6, "./load": 11, "./object": 15, "./support": 30 }], 11: [function(e, t, r) {
        "use strict";
        var u = e("./utils"), i = e("./external"), n = e("./utf8"), s = e("./zipEntries"), a = e("./stream/Crc32Probe"), l = e("./nodejsUtils");
        function f(n2) {
          return new i.Promise(function(e2, t2) {
            var r2 = n2.decompressed.getContentWorker().pipe(new a());
            r2.on("error", function(e3) {
              t2(e3);
            }).on("end", function() {
              r2.streamInfo.crc32 !== n2.decompressed.crc32 ? t2(new Error("Corrupted zip : CRC32 mismatch")) : e2();
            }).resume();
          });
        }
        t.exports = function(e2, o) {
          var h = this;
          return o = u.extend(o || {}, { base64: false, checkCRC32: false, optimizedBinaryString: false, createFolders: false, decodeFileName: n.utf8decode }), l.isNode && l.isStream(e2) ? i.Promise.reject(new Error("JSZip can't accept a stream when loading a zip file.")) : u.prepareContent("the loaded zip file", e2, true, o.optimizedBinaryString, o.base64).then(function(e3) {
            var t2 = new s(o);
            return t2.load(e3), t2;
          }).then(function(e3) {
            var t2 = [i.Promise.resolve(e3)], r2 = e3.files;
            if (o.checkCRC32) for (var n2 = 0; n2 < r2.length; n2++) t2.push(f(r2[n2]));
            return i.Promise.all(t2);
          }).then(function(e3) {
            for (var t2 = e3.shift(), r2 = t2.files, n2 = 0; n2 < r2.length; n2++) {
              var i2 = r2[n2], s2 = i2.fileNameStr, a2 = u.resolve(i2.fileNameStr);
              h.file(a2, i2.decompressed, { binary: true, optimizedBinaryString: true, date: i2.date, dir: i2.dir, comment: i2.fileCommentStr.length ? i2.fileCommentStr : null, unixPermissions: i2.unixPermissions, dosPermissions: i2.dosPermissions, createFolders: o.createFolders }), i2.dir || (h.file(a2).unsafeOriginalName = s2);
            }
            return t2.zipComment.length && (h.comment = t2.zipComment), h;
          });
        };
      }, { "./external": 6, "./nodejsUtils": 14, "./stream/Crc32Probe": 25, "./utf8": 31, "./utils": 32, "./zipEntries": 33 }], 12: [function(e, t, r) {
        "use strict";
        var n = e("../utils"), i = e("../stream/GenericWorker");
        function s(e2, t2) {
          i.call(this, "Nodejs stream input adapter for " + e2), this._upstreamEnded = false, this._bindStream(t2);
        }
        n.inherits(s, i), s.prototype._bindStream = function(e2) {
          var t2 = this;
          (this._stream = e2).pause(), e2.on("data", function(e3) {
            t2.push({ data: e3, meta: { percent: 0 } });
          }).on("error", function(e3) {
            t2.isPaused ? this.generatedError = e3 : t2.error(e3);
          }).on("end", function() {
            t2.isPaused ? t2._upstreamEnded = true : t2.end();
          });
        }, s.prototype.pause = function() {
          return !!i.prototype.pause.call(this) && (this._stream.pause(), true);
        }, s.prototype.resume = function() {
          return !!i.prototype.resume.call(this) && (this._upstreamEnded ? this.end() : this._stream.resume(), true);
        }, t.exports = s;
      }, { "../stream/GenericWorker": 28, "../utils": 32 }], 13: [function(e, t, r) {
        "use strict";
        var i = e("readable-stream").Readable;
        function n(e2, t2, r2) {
          i.call(this, t2), this._helper = e2;
          var n2 = this;
          e2.on("data", function(e3, t3) {
            n2.push(e3) || n2._helper.pause(), r2 && r2(t3);
          }).on("error", function(e3) {
            n2.emit("error", e3);
          }).on("end", function() {
            n2.push(null);
          });
        }
        e("../utils").inherits(n, i), n.prototype._read = function() {
          this._helper.resume();
        }, t.exports = n;
      }, { "../utils": 32, "readable-stream": 16 }], 14: [function(e, t, r) {
        "use strict";
        t.exports = { isNode: "undefined" != typeof Buffer, newBufferFrom: function(e2, t2) {
          if (Buffer.from && Buffer.from !== Uint8Array.from) return Buffer.from(e2, t2);
          if ("number" == typeof e2) throw new Error('The "data" argument must not be a number');
          return new Buffer(e2, t2);
        }, allocBuffer: function(e2) {
          if (Buffer.alloc) return Buffer.alloc(e2);
          var t2 = new Buffer(e2);
          return t2.fill(0), t2;
        }, isBuffer: function(e2) {
          return Buffer.isBuffer(e2);
        }, isStream: function(e2) {
          return e2 && "function" == typeof e2.on && "function" == typeof e2.pause && "function" == typeof e2.resume;
        } };
      }, {}], 15: [function(e, t, r) {
        "use strict";
        function s(e2, t2, r2) {
          var n2, i2 = u.getTypeOf(t2), s2 = u.extend(r2 || {}, f);
          s2.date = s2.date || /* @__PURE__ */ new Date(), null !== s2.compression && (s2.compression = s2.compression.toUpperCase()), "string" == typeof s2.unixPermissions && (s2.unixPermissions = parseInt(s2.unixPermissions, 8)), s2.unixPermissions && 16384 & s2.unixPermissions && (s2.dir = true), s2.dosPermissions && 16 & s2.dosPermissions && (s2.dir = true), s2.dir && (e2 = g(e2)), s2.createFolders && (n2 = _(e2)) && b.call(this, n2, true);
          var a2 = "string" === i2 && false === s2.binary && false === s2.base64;
          r2 && void 0 !== r2.binary || (s2.binary = !a2), (t2 instanceof c && 0 === t2.uncompressedSize || s2.dir || !t2 || 0 === t2.length) && (s2.base64 = false, s2.binary = true, t2 = "", s2.compression = "STORE", i2 = "string");
          var o2 = null;
          o2 = t2 instanceof c || t2 instanceof l ? t2 : p.isNode && p.isStream(t2) ? new m(e2, t2) : u.prepareContent(e2, t2, s2.binary, s2.optimizedBinaryString, s2.base64);
          var h2 = new d(e2, o2, s2);
          this.files[e2] = h2;
        }
        var i = e("./utf8"), u = e("./utils"), l = e("./stream/GenericWorker"), a = e("./stream/StreamHelper"), f = e("./defaults"), c = e("./compressedObject"), d = e("./zipObject"), o = e("./generate"), p = e("./nodejsUtils"), m = e("./nodejs/NodejsStreamInputAdapter"), _ = function(e2) {
          "/" === e2.slice(-1) && (e2 = e2.substring(0, e2.length - 1));
          var t2 = e2.lastIndexOf("/");
          return 0 < t2 ? e2.substring(0, t2) : "";
        }, g = function(e2) {
          return "/" !== e2.slice(-1) && (e2 += "/"), e2;
        }, b = function(e2, t2) {
          return t2 = void 0 !== t2 ? t2 : f.createFolders, e2 = g(e2), this.files[e2] || s.call(this, e2, null, { dir: true, createFolders: t2 }), this.files[e2];
        };
        function h(e2) {
          return "[object RegExp]" === Object.prototype.toString.call(e2);
        }
        var n = { load: function() {
          throw new Error("This method has been removed in JSZip 3.0, please check the upgrade guide.");
        }, forEach: function(e2) {
          var t2, r2, n2;
          for (t2 in this.files) n2 = this.files[t2], (r2 = t2.slice(this.root.length, t2.length)) && t2.slice(0, this.root.length) === this.root && e2(r2, n2);
        }, filter: function(r2) {
          var n2 = [];
          return this.forEach(function(e2, t2) {
            r2(e2, t2) && n2.push(t2);
          }), n2;
        }, file: function(e2, t2, r2) {
          if (1 !== arguments.length) return e2 = this.root + e2, s.call(this, e2, t2, r2), this;
          if (h(e2)) {
            var n2 = e2;
            return this.filter(function(e3, t3) {
              return !t3.dir && n2.test(e3);
            });
          }
          var i2 = this.files[this.root + e2];
          return i2 && !i2.dir ? i2 : null;
        }, folder: function(r2) {
          if (!r2) return this;
          if (h(r2)) return this.filter(function(e3, t3) {
            return t3.dir && r2.test(e3);
          });
          var e2 = this.root + r2, t2 = b.call(this, e2), n2 = this.clone();
          return n2.root = t2.name, n2;
        }, remove: function(r2) {
          r2 = this.root + r2;
          var e2 = this.files[r2];
          if (e2 || ("/" !== r2.slice(-1) && (r2 += "/"), e2 = this.files[r2]), e2 && !e2.dir) delete this.files[r2];
          else for (var t2 = this.filter(function(e3, t3) {
            return t3.name.slice(0, r2.length) === r2;
          }), n2 = 0; n2 < t2.length; n2++) delete this.files[t2[n2].name];
          return this;
        }, generate: function() {
          throw new Error("This method has been removed in JSZip 3.0, please check the upgrade guide.");
        }, generateInternalStream: function(e2) {
          var t2, r2 = {};
          try {
            if ((r2 = u.extend(e2 || {}, { streamFiles: false, compression: "STORE", compressionOptions: null, type: "", platform: "DOS", comment: null, mimeType: "application/zip", encodeFileName: i.utf8encode })).type = r2.type.toLowerCase(), r2.compression = r2.compression.toUpperCase(), "binarystring" === r2.type && (r2.type = "string"), !r2.type) throw new Error("No output type specified.");
            u.checkSupport(r2.type), "darwin" !== r2.platform && "freebsd" !== r2.platform && "linux" !== r2.platform && "sunos" !== r2.platform || (r2.platform = "UNIX"), "win32" === r2.platform && (r2.platform = "DOS");
            var n2 = r2.comment || this.comment || "";
            t2 = o.generateWorker(this, r2, n2);
          } catch (e3) {
            (t2 = new l("error")).error(e3);
          }
          return new a(t2, r2.type || "string", r2.mimeType);
        }, generateAsync: function(e2, t2) {
          return this.generateInternalStream(e2).accumulate(t2);
        }, generateNodeStream: function(e2, t2) {
          return (e2 = e2 || {}).type || (e2.type = "nodebuffer"), this.generateInternalStream(e2).toNodejsStream(t2);
        } };
        t.exports = n;
      }, { "./compressedObject": 2, "./defaults": 5, "./generate": 9, "./nodejs/NodejsStreamInputAdapter": 12, "./nodejsUtils": 14, "./stream/GenericWorker": 28, "./stream/StreamHelper": 29, "./utf8": 31, "./utils": 32, "./zipObject": 35 }], 16: [function(e, t, r) {
        "use strict";
        t.exports = e("stream");
      }, { stream: void 0 }], 17: [function(e, t, r) {
        "use strict";
        var n = e("./DataReader");
        function i(e2) {
          n.call(this, e2);
          for (var t2 = 0; t2 < this.data.length; t2++) e2[t2] = 255 & e2[t2];
        }
        e("../utils").inherits(i, n), i.prototype.byteAt = function(e2) {
          return this.data[this.zero + e2];
        }, i.prototype.lastIndexOfSignature = function(e2) {
          for (var t2 = e2.charCodeAt(0), r2 = e2.charCodeAt(1), n2 = e2.charCodeAt(2), i2 = e2.charCodeAt(3), s = this.length - 4; 0 <= s; --s) if (this.data[s] === t2 && this.data[s + 1] === r2 && this.data[s + 2] === n2 && this.data[s + 3] === i2) return s - this.zero;
          return -1;
        }, i.prototype.readAndCheckSignature = function(e2) {
          var t2 = e2.charCodeAt(0), r2 = e2.charCodeAt(1), n2 = e2.charCodeAt(2), i2 = e2.charCodeAt(3), s = this.readData(4);
          return t2 === s[0] && r2 === s[1] && n2 === s[2] && i2 === s[3];
        }, i.prototype.readData = function(e2) {
          if (this.checkOffset(e2), 0 === e2) return [];
          var t2 = this.data.slice(this.zero + this.index, this.zero + this.index + e2);
          return this.index += e2, t2;
        }, t.exports = i;
      }, { "../utils": 32, "./DataReader": 18 }], 18: [function(e, t, r) {
        "use strict";
        var n = e("../utils");
        function i(e2) {
          this.data = e2, this.length = e2.length, this.index = 0, this.zero = 0;
        }
        i.prototype = { checkOffset: function(e2) {
          this.checkIndex(this.index + e2);
        }, checkIndex: function(e2) {
          if (this.length < this.zero + e2 || e2 < 0) throw new Error("End of data reached (data length = " + this.length + ", asked index = " + e2 + "). Corrupted zip ?");
        }, setIndex: function(e2) {
          this.checkIndex(e2), this.index = e2;
        }, skip: function(e2) {
          this.setIndex(this.index + e2);
        }, byteAt: function() {
        }, readInt: function(e2) {
          var t2, r2 = 0;
          for (this.checkOffset(e2), t2 = this.index + e2 - 1; t2 >= this.index; t2--) r2 = (r2 << 8) + this.byteAt(t2);
          return this.index += e2, r2;
        }, readString: function(e2) {
          return n.transformTo("string", this.readData(e2));
        }, readData: function() {
        }, lastIndexOfSignature: function() {
        }, readAndCheckSignature: function() {
        }, readDate: function() {
          var e2 = this.readInt(4);
          return new Date(Date.UTC(1980 + (e2 >> 25 & 127), (e2 >> 21 & 15) - 1, e2 >> 16 & 31, e2 >> 11 & 31, e2 >> 5 & 63, (31 & e2) << 1));
        } }, t.exports = i;
      }, { "../utils": 32 }], 19: [function(e, t, r) {
        "use strict";
        var n = e("./Uint8ArrayReader");
        function i(e2) {
          n.call(this, e2);
        }
        e("../utils").inherits(i, n), i.prototype.readData = function(e2) {
          this.checkOffset(e2);
          var t2 = this.data.slice(this.zero + this.index, this.zero + this.index + e2);
          return this.index += e2, t2;
        }, t.exports = i;
      }, { "../utils": 32, "./Uint8ArrayReader": 21 }], 20: [function(e, t, r) {
        "use strict";
        var n = e("./DataReader");
        function i(e2) {
          n.call(this, e2);
        }
        e("../utils").inherits(i, n), i.prototype.byteAt = function(e2) {
          return this.data.charCodeAt(this.zero + e2);
        }, i.prototype.lastIndexOfSignature = function(e2) {
          return this.data.lastIndexOf(e2) - this.zero;
        }, i.prototype.readAndCheckSignature = function(e2) {
          return e2 === this.readData(4);
        }, i.prototype.readData = function(e2) {
          this.checkOffset(e2);
          var t2 = this.data.slice(this.zero + this.index, this.zero + this.index + e2);
          return this.index += e2, t2;
        }, t.exports = i;
      }, { "../utils": 32, "./DataReader": 18 }], 21: [function(e, t, r) {
        "use strict";
        var n = e("./ArrayReader");
        function i(e2) {
          n.call(this, e2);
        }
        e("../utils").inherits(i, n), i.prototype.readData = function(e2) {
          if (this.checkOffset(e2), 0 === e2) return new Uint8Array(0);
          var t2 = this.data.subarray(this.zero + this.index, this.zero + this.index + e2);
          return this.index += e2, t2;
        }, t.exports = i;
      }, { "../utils": 32, "./ArrayReader": 17 }], 22: [function(e, t, r) {
        "use strict";
        var n = e("../utils"), i = e("../support"), s = e("./ArrayReader"), a = e("./StringReader"), o = e("./NodeBufferReader"), h = e("./Uint8ArrayReader");
        t.exports = function(e2) {
          var t2 = n.getTypeOf(e2);
          return n.checkSupport(t2), "string" !== t2 || i.uint8array ? "nodebuffer" === t2 ? new o(e2) : i.uint8array ? new h(n.transformTo("uint8array", e2)) : new s(n.transformTo("array", e2)) : new a(e2);
        };
      }, { "../support": 30, "../utils": 32, "./ArrayReader": 17, "./NodeBufferReader": 19, "./StringReader": 20, "./Uint8ArrayReader": 21 }], 23: [function(e, t, r) {
        "use strict";
        r.LOCAL_FILE_HEADER = "PK", r.CENTRAL_FILE_HEADER = "PK", r.CENTRAL_DIRECTORY_END = "PK", r.ZIP64_CENTRAL_DIRECTORY_LOCATOR = "PK\x07", r.ZIP64_CENTRAL_DIRECTORY_END = "PK", r.DATA_DESCRIPTOR = "PK\x07\b";
      }, {}], 24: [function(e, t, r) {
        "use strict";
        var n = e("./GenericWorker"), i = e("../utils");
        function s(e2) {
          n.call(this, "ConvertWorker to " + e2), this.destType = e2;
        }
        i.inherits(s, n), s.prototype.processChunk = function(e2) {
          this.push({ data: i.transformTo(this.destType, e2.data), meta: e2.meta });
        }, t.exports = s;
      }, { "../utils": 32, "./GenericWorker": 28 }], 25: [function(e, t, r) {
        "use strict";
        var n = e("./GenericWorker"), i = e("../crc32");
        function s() {
          n.call(this, "Crc32Probe"), this.withStreamInfo("crc32", 0);
        }
        e("../utils").inherits(s, n), s.prototype.processChunk = function(e2) {
          this.streamInfo.crc32 = i(e2.data, this.streamInfo.crc32 || 0), this.push(e2);
        }, t.exports = s;
      }, { "../crc32": 4, "../utils": 32, "./GenericWorker": 28 }], 26: [function(e, t, r) {
        "use strict";
        var n = e("../utils"), i = e("./GenericWorker");
        function s(e2) {
          i.call(this, "DataLengthProbe for " + e2), this.propName = e2, this.withStreamInfo(e2, 0);
        }
        n.inherits(s, i), s.prototype.processChunk = function(e2) {
          if (e2) {
            var t2 = this.streamInfo[this.propName] || 0;
            this.streamInfo[this.propName] = t2 + e2.data.length;
          }
          i.prototype.processChunk.call(this, e2);
        }, t.exports = s;
      }, { "../utils": 32, "./GenericWorker": 28 }], 27: [function(e, t, r) {
        "use strict";
        var n = e("../utils"), i = e("./GenericWorker");
        function s(e2) {
          i.call(this, "DataWorker");
          var t2 = this;
          this.dataIsReady = false, this.index = 0, this.max = 0, this.data = null, this.type = "", this._tickScheduled = false, e2.then(function(e3) {
            t2.dataIsReady = true, t2.data = e3, t2.max = e3 && e3.length || 0, t2.type = n.getTypeOf(e3), t2.isPaused || t2._tickAndRepeat();
          }, function(e3) {
            t2.error(e3);
          });
        }
        n.inherits(s, i), s.prototype.cleanUp = function() {
          i.prototype.cleanUp.call(this), this.data = null;
        }, s.prototype.resume = function() {
          return !!i.prototype.resume.call(this) && (!this._tickScheduled && this.dataIsReady && (this._tickScheduled = true, n.delay(this._tickAndRepeat, [], this)), true);
        }, s.prototype._tickAndRepeat = function() {
          this._tickScheduled = false, this.isPaused || this.isFinished || (this._tick(), this.isFinished || (n.delay(this._tickAndRepeat, [], this), this._tickScheduled = true));
        }, s.prototype._tick = function() {
          if (this.isPaused || this.isFinished) return false;
          var e2 = null, t2 = Math.min(this.max, this.index + 16384);
          if (this.index >= this.max) return this.end();
          switch (this.type) {
            case "string":
              e2 = this.data.substring(this.index, t2);
              break;
            case "uint8array":
              e2 = this.data.subarray(this.index, t2);
              break;
            case "array":
            case "nodebuffer":
              e2 = this.data.slice(this.index, t2);
          }
          return this.index = t2, this.push({ data: e2, meta: { percent: this.max ? this.index / this.max * 100 : 0 } });
        }, t.exports = s;
      }, { "../utils": 32, "./GenericWorker": 28 }], 28: [function(e, t, r) {
        "use strict";
        function n(e2) {
          this.name = e2 || "default", this.streamInfo = {}, this.generatedError = null, this.extraStreamInfo = {}, this.isPaused = true, this.isFinished = false, this.isLocked = false, this._listeners = { data: [], end: [], error: [] }, this.previous = null;
        }
        n.prototype = { push: function(e2) {
          this.emit("data", e2);
        }, end: function() {
          if (this.isFinished) return false;
          this.flush();
          try {
            this.emit("end"), this.cleanUp(), this.isFinished = true;
          } catch (e2) {
            this.emit("error", e2);
          }
          return true;
        }, error: function(e2) {
          return !this.isFinished && (this.isPaused ? this.generatedError = e2 : (this.isFinished = true, this.emit("error", e2), this.previous && this.previous.error(e2), this.cleanUp()), true);
        }, on: function(e2, t2) {
          return this._listeners[e2].push(t2), this;
        }, cleanUp: function() {
          this.streamInfo = this.generatedError = this.extraStreamInfo = null, this._listeners = [];
        }, emit: function(e2, t2) {
          if (this._listeners[e2]) for (var r2 = 0; r2 < this._listeners[e2].length; r2++) this._listeners[e2][r2].call(this, t2);
        }, pipe: function(e2) {
          return e2.registerPrevious(this);
        }, registerPrevious: function(e2) {
          if (this.isLocked) throw new Error("The stream '" + this + "' has already been used.");
          this.streamInfo = e2.streamInfo, this.mergeStreamInfo(), this.previous = e2;
          var t2 = this;
          return e2.on("data", function(e3) {
            t2.processChunk(e3);
          }), e2.on("end", function() {
            t2.end();
          }), e2.on("error", function(e3) {
            t2.error(e3);
          }), this;
        }, pause: function() {
          return !this.isPaused && !this.isFinished && (this.isPaused = true, this.previous && this.previous.pause(), true);
        }, resume: function() {
          if (!this.isPaused || this.isFinished) return false;
          var e2 = this.isPaused = false;
          return this.generatedError && (this.error(this.generatedError), e2 = true), this.previous && this.previous.resume(), !e2;
        }, flush: function() {
        }, processChunk: function(e2) {
          this.push(e2);
        }, withStreamInfo: function(e2, t2) {
          return this.extraStreamInfo[e2] = t2, this.mergeStreamInfo(), this;
        }, mergeStreamInfo: function() {
          for (var e2 in this.extraStreamInfo) Object.prototype.hasOwnProperty.call(this.extraStreamInfo, e2) && (this.streamInfo[e2] = this.extraStreamInfo[e2]);
        }, lock: function() {
          if (this.isLocked) throw new Error("The stream '" + this + "' has already been used.");
          this.isLocked = true, this.previous && this.previous.lock();
        }, toString: function() {
          var e2 = "Worker " + this.name;
          return this.previous ? this.previous + " -> " + e2 : e2;
        } }, t.exports = n;
      }, {}], 29: [function(e, t, r) {
        "use strict";
        var h = e("../utils"), i = e("./ConvertWorker"), s = e("./GenericWorker"), u = e("../base64"), n = e("../support"), a = e("../external"), o = null;
        if (n.nodestream) try {
          o = e("../nodejs/NodejsStreamOutputAdapter");
        } catch (e2) {
        }
        function l(e2, o2) {
          return new a.Promise(function(t2, r2) {
            var n2 = [], i2 = e2._internalType, s2 = e2._outputType, a2 = e2._mimeType;
            e2.on("data", function(e3, t3) {
              n2.push(e3), o2 && o2(t3);
            }).on("error", function(e3) {
              n2 = [], r2(e3);
            }).on("end", function() {
              try {
                var e3 = (function(e4, t3, r3) {
                  switch (e4) {
                    case "blob":
                      return h.newBlob(h.transformTo("arraybuffer", t3), r3);
                    case "base64":
                      return u.encode(t3);
                    default:
                      return h.transformTo(e4, t3);
                  }
                })(s2, (function(e4, t3) {
                  var r3, n3 = 0, i3 = null, s3 = 0;
                  for (r3 = 0; r3 < t3.length; r3++) s3 += t3[r3].length;
                  switch (e4) {
                    case "string":
                      return t3.join("");
                    case "array":
                      return Array.prototype.concat.apply([], t3);
                    case "uint8array":
                      for (i3 = new Uint8Array(s3), r3 = 0; r3 < t3.length; r3++) i3.set(t3[r3], n3), n3 += t3[r3].length;
                      return i3;
                    case "nodebuffer":
                      return Buffer.concat(t3);
                    default:
                      throw new Error("concat : unsupported type '" + e4 + "'");
                  }
                })(i2, n2), a2);
                t2(e3);
              } catch (e4) {
                r2(e4);
              }
              n2 = [];
            }).resume();
          });
        }
        function f(e2, t2, r2) {
          var n2 = t2;
          switch (t2) {
            case "blob":
            case "arraybuffer":
              n2 = "uint8array";
              break;
            case "base64":
              n2 = "string";
          }
          try {
            this._internalType = n2, this._outputType = t2, this._mimeType = r2, h.checkSupport(n2), this._worker = e2.pipe(new i(n2)), e2.lock();
          } catch (e3) {
            this._worker = new s("error"), this._worker.error(e3);
          }
        }
        f.prototype = { accumulate: function(e2) {
          return l(this, e2);
        }, on: function(e2, t2) {
          var r2 = this;
          return "data" === e2 ? this._worker.on(e2, function(e3) {
            t2.call(r2, e3.data, e3.meta);
          }) : this._worker.on(e2, function() {
            h.delay(t2, arguments, r2);
          }), this;
        }, resume: function() {
          return h.delay(this._worker.resume, [], this._worker), this;
        }, pause: function() {
          return this._worker.pause(), this;
        }, toNodejsStream: function(e2) {
          if (h.checkSupport("nodestream"), "nodebuffer" !== this._outputType) throw new Error(this._outputType + " is not supported by this method");
          return new o(this, { objectMode: "nodebuffer" !== this._outputType }, e2);
        } }, t.exports = f;
      }, { "../base64": 1, "../external": 6, "../nodejs/NodejsStreamOutputAdapter": 13, "../support": 30, "../utils": 32, "./ConvertWorker": 24, "./GenericWorker": 28 }], 30: [function(e, t, r) {
        "use strict";
        if (r.base64 = true, r.array = true, r.string = true, r.arraybuffer = "undefined" != typeof ArrayBuffer && "undefined" != typeof Uint8Array, r.nodebuffer = "undefined" != typeof Buffer, r.uint8array = "undefined" != typeof Uint8Array, "undefined" == typeof ArrayBuffer) r.blob = false;
        else {
          var n = new ArrayBuffer(0);
          try {
            r.blob = 0 === new Blob([n], { type: "application/zip" }).size;
          } catch (e2) {
            try {
              var i = new (self.BlobBuilder || self.WebKitBlobBuilder || self.MozBlobBuilder || self.MSBlobBuilder)();
              i.append(n), r.blob = 0 === i.getBlob("application/zip").size;
            } catch (e3) {
              r.blob = false;
            }
          }
        }
        try {
          r.nodestream = !!e("readable-stream").Readable;
        } catch (e2) {
          r.nodestream = false;
        }
      }, { "readable-stream": 16 }], 31: [function(e, t, s) {
        "use strict";
        for (var o = e("./utils"), h = e("./support"), r = e("./nodejsUtils"), n = e("./stream/GenericWorker"), u = new Array(256), i = 0; i < 256; i++) u[i] = 252 <= i ? 6 : 248 <= i ? 5 : 240 <= i ? 4 : 224 <= i ? 3 : 192 <= i ? 2 : 1;
        u[254] = u[254] = 1;
        function a() {
          n.call(this, "utf-8 decode"), this.leftOver = null;
        }
        function l() {
          n.call(this, "utf-8 encode");
        }
        s.utf8encode = function(e2) {
          return h.nodebuffer ? r.newBufferFrom(e2, "utf-8") : (function(e3) {
            var t2, r2, n2, i2, s2, a2 = e3.length, o2 = 0;
            for (i2 = 0; i2 < a2; i2++) 55296 == (64512 & (r2 = e3.charCodeAt(i2))) && i2 + 1 < a2 && 56320 == (64512 & (n2 = e3.charCodeAt(i2 + 1))) && (r2 = 65536 + (r2 - 55296 << 10) + (n2 - 56320), i2++), o2 += r2 < 128 ? 1 : r2 < 2048 ? 2 : r2 < 65536 ? 3 : 4;
            for (t2 = h.uint8array ? new Uint8Array(o2) : new Array(o2), i2 = s2 = 0; s2 < o2; i2++) 55296 == (64512 & (r2 = e3.charCodeAt(i2))) && i2 + 1 < a2 && 56320 == (64512 & (n2 = e3.charCodeAt(i2 + 1))) && (r2 = 65536 + (r2 - 55296 << 10) + (n2 - 56320), i2++), r2 < 128 ? t2[s2++] = r2 : (r2 < 2048 ? t2[s2++] = 192 | r2 >>> 6 : (r2 < 65536 ? t2[s2++] = 224 | r2 >>> 12 : (t2[s2++] = 240 | r2 >>> 18, t2[s2++] = 128 | r2 >>> 12 & 63), t2[s2++] = 128 | r2 >>> 6 & 63), t2[s2++] = 128 | 63 & r2);
            return t2;
          })(e2);
        }, s.utf8decode = function(e2) {
          return h.nodebuffer ? o.transformTo("nodebuffer", e2).toString("utf-8") : (function(e3) {
            var t2, r2, n2, i2, s2 = e3.length, a2 = new Array(2 * s2);
            for (t2 = r2 = 0; t2 < s2; ) if ((n2 = e3[t2++]) < 128) a2[r2++] = n2;
            else if (4 < (i2 = u[n2])) a2[r2++] = 65533, t2 += i2 - 1;
            else {
              for (n2 &= 2 === i2 ? 31 : 3 === i2 ? 15 : 7; 1 < i2 && t2 < s2; ) n2 = n2 << 6 | 63 & e3[t2++], i2--;
              1 < i2 ? a2[r2++] = 65533 : n2 < 65536 ? a2[r2++] = n2 : (n2 -= 65536, a2[r2++] = 55296 | n2 >> 10 & 1023, a2[r2++] = 56320 | 1023 & n2);
            }
            return a2.length !== r2 && (a2.subarray ? a2 = a2.subarray(0, r2) : a2.length = r2), o.applyFromCharCode(a2);
          })(e2 = o.transformTo(h.uint8array ? "uint8array" : "array", e2));
        }, o.inherits(a, n), a.prototype.processChunk = function(e2) {
          var t2 = o.transformTo(h.uint8array ? "uint8array" : "array", e2.data);
          if (this.leftOver && this.leftOver.length) {
            if (h.uint8array) {
              var r2 = t2;
              (t2 = new Uint8Array(r2.length + this.leftOver.length)).set(this.leftOver, 0), t2.set(r2, this.leftOver.length);
            } else t2 = this.leftOver.concat(t2);
            this.leftOver = null;
          }
          var n2 = (function(e3, t3) {
            var r3;
            for ((t3 = t3 || e3.length) > e3.length && (t3 = e3.length), r3 = t3 - 1; 0 <= r3 && 128 == (192 & e3[r3]); ) r3--;
            return r3 < 0 ? t3 : 0 === r3 ? t3 : r3 + u[e3[r3]] > t3 ? r3 : t3;
          })(t2), i2 = t2;
          n2 !== t2.length && (h.uint8array ? (i2 = t2.subarray(0, n2), this.leftOver = t2.subarray(n2, t2.length)) : (i2 = t2.slice(0, n2), this.leftOver = t2.slice(n2, t2.length))), this.push({ data: s.utf8decode(i2), meta: e2.meta });
        }, a.prototype.flush = function() {
          this.leftOver && this.leftOver.length && (this.push({ data: s.utf8decode(this.leftOver), meta: {} }), this.leftOver = null);
        }, s.Utf8DecodeWorker = a, o.inherits(l, n), l.prototype.processChunk = function(e2) {
          this.push({ data: s.utf8encode(e2.data), meta: e2.meta });
        }, s.Utf8EncodeWorker = l;
      }, { "./nodejsUtils": 14, "./stream/GenericWorker": 28, "./support": 30, "./utils": 32 }], 32: [function(e, t, a) {
        "use strict";
        var o = e("./support"), h = e("./base64"), r = e("./nodejsUtils"), u = e("./external");
        function n(e2) {
          return e2;
        }
        function l(e2, t2) {
          for (var r2 = 0; r2 < e2.length; ++r2) t2[r2] = 255 & e2.charCodeAt(r2);
          return t2;
        }
        e("setimmediate"), a.newBlob = function(t2, r2) {
          a.checkSupport("blob");
          try {
            return new Blob([t2], { type: r2 });
          } catch (e2) {
            try {
              var n2 = new (self.BlobBuilder || self.WebKitBlobBuilder || self.MozBlobBuilder || self.MSBlobBuilder)();
              return n2.append(t2), n2.getBlob(r2);
            } catch (e3) {
              throw new Error("Bug : can't construct the Blob.");
            }
          }
        };
        var i = { stringifyByChunk: function(e2, t2, r2) {
          var n2 = [], i2 = 0, s2 = e2.length;
          if (s2 <= r2) return String.fromCharCode.apply(null, e2);
          for (; i2 < s2; ) "array" === t2 || "nodebuffer" === t2 ? n2.push(String.fromCharCode.apply(null, e2.slice(i2, Math.min(i2 + r2, s2)))) : n2.push(String.fromCharCode.apply(null, e2.subarray(i2, Math.min(i2 + r2, s2)))), i2 += r2;
          return n2.join("");
        }, stringifyByChar: function(e2) {
          for (var t2 = "", r2 = 0; r2 < e2.length; r2++) t2 += String.fromCharCode(e2[r2]);
          return t2;
        }, applyCanBeUsed: { uint8array: (function() {
          try {
            return o.uint8array && 1 === String.fromCharCode.apply(null, new Uint8Array(1)).length;
          } catch (e2) {
            return false;
          }
        })(), nodebuffer: (function() {
          try {
            return o.nodebuffer && 1 === String.fromCharCode.apply(null, r.allocBuffer(1)).length;
          } catch (e2) {
            return false;
          }
        })() } };
        function s(e2) {
          var t2 = 65536, r2 = a.getTypeOf(e2), n2 = true;
          if ("uint8array" === r2 ? n2 = i.applyCanBeUsed.uint8array : "nodebuffer" === r2 && (n2 = i.applyCanBeUsed.nodebuffer), n2) for (; 1 < t2; ) try {
            return i.stringifyByChunk(e2, r2, t2);
          } catch (e3) {
            t2 = Math.floor(t2 / 2);
          }
          return i.stringifyByChar(e2);
        }
        function f(e2, t2) {
          for (var r2 = 0; r2 < e2.length; r2++) t2[r2] = e2[r2];
          return t2;
        }
        a.applyFromCharCode = s;
        var c = {};
        c.string = { string: n, array: function(e2) {
          return l(e2, new Array(e2.length));
        }, arraybuffer: function(e2) {
          return c.string.uint8array(e2).buffer;
        }, uint8array: function(e2) {
          return l(e2, new Uint8Array(e2.length));
        }, nodebuffer: function(e2) {
          return l(e2, r.allocBuffer(e2.length));
        } }, c.array = { string: s, array: n, arraybuffer: function(e2) {
          return new Uint8Array(e2).buffer;
        }, uint8array: function(e2) {
          return new Uint8Array(e2);
        }, nodebuffer: function(e2) {
          return r.newBufferFrom(e2);
        } }, c.arraybuffer = { string: function(e2) {
          return s(new Uint8Array(e2));
        }, array: function(e2) {
          return f(new Uint8Array(e2), new Array(e2.byteLength));
        }, arraybuffer: n, uint8array: function(e2) {
          return new Uint8Array(e2);
        }, nodebuffer: function(e2) {
          return r.newBufferFrom(new Uint8Array(e2));
        } }, c.uint8array = { string: s, array: function(e2) {
          return f(e2, new Array(e2.length));
        }, arraybuffer: function(e2) {
          return e2.buffer;
        }, uint8array: n, nodebuffer: function(e2) {
          return r.newBufferFrom(e2);
        } }, c.nodebuffer = { string: s, array: function(e2) {
          return f(e2, new Array(e2.length));
        }, arraybuffer: function(e2) {
          return c.nodebuffer.uint8array(e2).buffer;
        }, uint8array: function(e2) {
          return f(e2, new Uint8Array(e2.length));
        }, nodebuffer: n }, a.transformTo = function(e2, t2) {
          if (t2 = t2 || "", !e2) return t2;
          a.checkSupport(e2);
          var r2 = a.getTypeOf(t2);
          return c[r2][e2](t2);
        }, a.resolve = function(e2) {
          for (var t2 = e2.split("/"), r2 = [], n2 = 0; n2 < t2.length; n2++) {
            var i2 = t2[n2];
            "." === i2 || "" === i2 && 0 !== n2 && n2 !== t2.length - 1 || (".." === i2 ? r2.pop() : r2.push(i2));
          }
          return r2.join("/");
        }, a.getTypeOf = function(e2) {
          return "string" == typeof e2 ? "string" : "[object Array]" === Object.prototype.toString.call(e2) ? "array" : o.nodebuffer && r.isBuffer(e2) ? "nodebuffer" : o.uint8array && e2 instanceof Uint8Array ? "uint8array" : o.arraybuffer && e2 instanceof ArrayBuffer ? "arraybuffer" : void 0;
        }, a.checkSupport = function(e2) {
          if (!o[e2.toLowerCase()]) throw new Error(e2 + " is not supported by this platform");
        }, a.MAX_VALUE_16BITS = 65535, a.MAX_VALUE_32BITS = -1, a.pretty = function(e2) {
          var t2, r2, n2 = "";
          for (r2 = 0; r2 < (e2 || "").length; r2++) n2 += "\\x" + ((t2 = e2.charCodeAt(r2)) < 16 ? "0" : "") + t2.toString(16).toUpperCase();
          return n2;
        }, a.delay = function(e2, t2, r2) {
          setImmediate(function() {
            e2.apply(r2 || null, t2 || []);
          });
        }, a.inherits = function(e2, t2) {
          function r2() {
          }
          r2.prototype = t2.prototype, e2.prototype = new r2();
        }, a.extend = function() {
          var e2, t2, r2 = {};
          for (e2 = 0; e2 < arguments.length; e2++) for (t2 in arguments[e2]) Object.prototype.hasOwnProperty.call(arguments[e2], t2) && void 0 === r2[t2] && (r2[t2] = arguments[e2][t2]);
          return r2;
        }, a.prepareContent = function(r2, e2, n2, i2, s2) {
          return u.Promise.resolve(e2).then(function(n3) {
            return o.blob && (n3 instanceof Blob || -1 !== ["[object File]", "[object Blob]"].indexOf(Object.prototype.toString.call(n3))) && "undefined" != typeof FileReader ? new u.Promise(function(t2, r3) {
              var e3 = new FileReader();
              e3.onload = function(e4) {
                t2(e4.target.result);
              }, e3.onerror = function(e4) {
                r3(e4.target.error);
              }, e3.readAsArrayBuffer(n3);
            }) : n3;
          }).then(function(e3) {
            var t2 = a.getTypeOf(e3);
            return t2 ? ("arraybuffer" === t2 ? e3 = a.transformTo("uint8array", e3) : "string" === t2 && (s2 ? e3 = h.decode(e3) : n2 && true !== i2 && (e3 = (function(e4) {
              return l(e4, o.uint8array ? new Uint8Array(e4.length) : new Array(e4.length));
            })(e3))), e3) : u.Promise.reject(new Error("Can't read the data of '" + r2 + "'. Is it in a supported JavaScript type (String, Blob, ArrayBuffer, etc) ?"));
          });
        };
      }, { "./base64": 1, "./external": 6, "./nodejsUtils": 14, "./support": 30, setimmediate: 54 }], 33: [function(e, t, r) {
        "use strict";
        var n = e("./reader/readerFor"), i = e("./utils"), s = e("./signature"), a = e("./zipEntry"), o = e("./support");
        function h(e2) {
          this.files = [], this.loadOptions = e2;
        }
        h.prototype = { checkSignature: function(e2) {
          if (!this.reader.readAndCheckSignature(e2)) {
            this.reader.index -= 4;
            var t2 = this.reader.readString(4);
            throw new Error("Corrupted zip or bug: unexpected signature (" + i.pretty(t2) + ", expected " + i.pretty(e2) + ")");
          }
        }, isSignature: function(e2, t2) {
          var r2 = this.reader.index;
          this.reader.setIndex(e2);
          var n2 = this.reader.readString(4) === t2;
          return this.reader.setIndex(r2), n2;
        }, readBlockEndOfCentral: function() {
          this.diskNumber = this.reader.readInt(2), this.diskWithCentralDirStart = this.reader.readInt(2), this.centralDirRecordsOnThisDisk = this.reader.readInt(2), this.centralDirRecords = this.reader.readInt(2), this.centralDirSize = this.reader.readInt(4), this.centralDirOffset = this.reader.readInt(4), this.zipCommentLength = this.reader.readInt(2);
          var e2 = this.reader.readData(this.zipCommentLength), t2 = o.uint8array ? "uint8array" : "array", r2 = i.transformTo(t2, e2);
          this.zipComment = this.loadOptions.decodeFileName(r2);
        }, readBlockZip64EndOfCentral: function() {
          this.zip64EndOfCentralSize = this.reader.readInt(8), this.reader.skip(4), this.diskNumber = this.reader.readInt(4), this.diskWithCentralDirStart = this.reader.readInt(4), this.centralDirRecordsOnThisDisk = this.reader.readInt(8), this.centralDirRecords = this.reader.readInt(8), this.centralDirSize = this.reader.readInt(8), this.centralDirOffset = this.reader.readInt(8), this.zip64ExtensibleData = {};
          for (var e2, t2, r2, n2 = this.zip64EndOfCentralSize - 44; 0 < n2; ) e2 = this.reader.readInt(2), t2 = this.reader.readInt(4), r2 = this.reader.readData(t2), this.zip64ExtensibleData[e2] = { id: e2, length: t2, value: r2 };
        }, readBlockZip64EndOfCentralLocator: function() {
          if (this.diskWithZip64CentralDirStart = this.reader.readInt(4), this.relativeOffsetEndOfZip64CentralDir = this.reader.readInt(8), this.disksCount = this.reader.readInt(4), 1 < this.disksCount) throw new Error("Multi-volumes zip are not supported");
        }, readLocalFiles: function() {
          var e2, t2;
          for (e2 = 0; e2 < this.files.length; e2++) t2 = this.files[e2], this.reader.setIndex(t2.localHeaderOffset), this.checkSignature(s.LOCAL_FILE_HEADER), t2.readLocalPart(this.reader), t2.handleUTF8(), t2.processAttributes();
        }, readCentralDir: function() {
          var e2;
          for (this.reader.setIndex(this.centralDirOffset); this.reader.readAndCheckSignature(s.CENTRAL_FILE_HEADER); ) (e2 = new a({ zip64: this.zip64 }, this.loadOptions)).readCentralPart(this.reader), this.files.push(e2);
          if (this.centralDirRecords !== this.files.length && 0 !== this.centralDirRecords && 0 === this.files.length) throw new Error("Corrupted zip or bug: expected " + this.centralDirRecords + " records in central dir, got " + this.files.length);
        }, readEndOfCentral: function() {
          var e2 = this.reader.lastIndexOfSignature(s.CENTRAL_DIRECTORY_END);
          if (e2 < 0) throw !this.isSignature(0, s.LOCAL_FILE_HEADER) ? new Error("Can't find end of central directory : is this a zip file ? If it is, see https://stuk.github.io/jszip/documentation/howto/read_zip.html") : new Error("Corrupted zip: can't find end of central directory");
          this.reader.setIndex(e2);
          var t2 = e2;
          if (this.checkSignature(s.CENTRAL_DIRECTORY_END), this.readBlockEndOfCentral(), this.diskNumber === i.MAX_VALUE_16BITS || this.diskWithCentralDirStart === i.MAX_VALUE_16BITS || this.centralDirRecordsOnThisDisk === i.MAX_VALUE_16BITS || this.centralDirRecords === i.MAX_VALUE_16BITS || this.centralDirSize === i.MAX_VALUE_32BITS || this.centralDirOffset === i.MAX_VALUE_32BITS) {
            if (this.zip64 = true, (e2 = this.reader.lastIndexOfSignature(s.ZIP64_CENTRAL_DIRECTORY_LOCATOR)) < 0) throw new Error("Corrupted zip: can't find the ZIP64 end of central directory locator");
            if (this.reader.setIndex(e2), this.checkSignature(s.ZIP64_CENTRAL_DIRECTORY_LOCATOR), this.readBlockZip64EndOfCentralLocator(), !this.isSignature(this.relativeOffsetEndOfZip64CentralDir, s.ZIP64_CENTRAL_DIRECTORY_END) && (this.relativeOffsetEndOfZip64CentralDir = this.reader.lastIndexOfSignature(s.ZIP64_CENTRAL_DIRECTORY_END), this.relativeOffsetEndOfZip64CentralDir < 0)) throw new Error("Corrupted zip: can't find the ZIP64 end of central directory");
            this.reader.setIndex(this.relativeOffsetEndOfZip64CentralDir), this.checkSignature(s.ZIP64_CENTRAL_DIRECTORY_END), this.readBlockZip64EndOfCentral();
          }
          var r2 = this.centralDirOffset + this.centralDirSize;
          this.zip64 && (r2 += 20, r2 += 12 + this.zip64EndOfCentralSize);
          var n2 = t2 - r2;
          if (0 < n2) this.isSignature(t2, s.CENTRAL_FILE_HEADER) || (this.reader.zero = n2);
          else if (n2 < 0) throw new Error("Corrupted zip: missing " + Math.abs(n2) + " bytes.");
        }, prepareReader: function(e2) {
          this.reader = n(e2);
        }, load: function(e2) {
          this.prepareReader(e2), this.readEndOfCentral(), this.readCentralDir(), this.readLocalFiles();
        } }, t.exports = h;
      }, { "./reader/readerFor": 22, "./signature": 23, "./support": 30, "./utils": 32, "./zipEntry": 34 }], 34: [function(e, t, r) {
        "use strict";
        var n = e("./reader/readerFor"), s = e("./utils"), i = e("./compressedObject"), a = e("./crc32"), o = e("./utf8"), h = e("./compressions"), u = e("./support");
        function l(e2, t2) {
          this.options = e2, this.loadOptions = t2;
        }
        l.prototype = { isEncrypted: function() {
          return 1 == (1 & this.bitFlag);
        }, useUTF8: function() {
          return 2048 == (2048 & this.bitFlag);
        }, readLocalPart: function(e2) {
          var t2, r2;
          if (e2.skip(22), this.fileNameLength = e2.readInt(2), r2 = e2.readInt(2), this.fileName = e2.readData(this.fileNameLength), e2.skip(r2), -1 === this.compressedSize || -1 === this.uncompressedSize) throw new Error("Bug or corrupted zip : didn't get enough information from the central directory (compressedSize === -1 || uncompressedSize === -1)");
          if (null === (t2 = (function(e3) {
            for (var t3 in h) if (Object.prototype.hasOwnProperty.call(h, t3) && h[t3].magic === e3) return h[t3];
            return null;
          })(this.compressionMethod))) throw new Error("Corrupted zip : compression " + s.pretty(this.compressionMethod) + " unknown (inner file : " + s.transformTo("string", this.fileName) + ")");
          this.decompressed = new i(this.compressedSize, this.uncompressedSize, this.crc32, t2, e2.readData(this.compressedSize));
        }, readCentralPart: function(e2) {
          this.versionMadeBy = e2.readInt(2), e2.skip(2), this.bitFlag = e2.readInt(2), this.compressionMethod = e2.readString(2), this.date = e2.readDate(), this.crc32 = e2.readInt(4), this.compressedSize = e2.readInt(4), this.uncompressedSize = e2.readInt(4);
          var t2 = e2.readInt(2);
          if (this.extraFieldsLength = e2.readInt(2), this.fileCommentLength = e2.readInt(2), this.diskNumberStart = e2.readInt(2), this.internalFileAttributes = e2.readInt(2), this.externalFileAttributes = e2.readInt(4), this.localHeaderOffset = e2.readInt(4), this.isEncrypted()) throw new Error("Encrypted zip are not supported");
          e2.skip(t2), this.readExtraFields(e2), this.parseZIP64ExtraField(e2), this.fileComment = e2.readData(this.fileCommentLength);
        }, processAttributes: function() {
          this.unixPermissions = null, this.dosPermissions = null;
          var e2 = this.versionMadeBy >> 8;
          this.dir = !!(16 & this.externalFileAttributes), 0 == e2 && (this.dosPermissions = 63 & this.externalFileAttributes), 3 == e2 && (this.unixPermissions = this.externalFileAttributes >> 16 & 65535), this.dir || "/" !== this.fileNameStr.slice(-1) || (this.dir = true);
        }, parseZIP64ExtraField: function() {
          if (this.extraFields[1]) {
            var e2 = n(this.extraFields[1].value);
            this.uncompressedSize === s.MAX_VALUE_32BITS && (this.uncompressedSize = e2.readInt(8)), this.compressedSize === s.MAX_VALUE_32BITS && (this.compressedSize = e2.readInt(8)), this.localHeaderOffset === s.MAX_VALUE_32BITS && (this.localHeaderOffset = e2.readInt(8)), this.diskNumberStart === s.MAX_VALUE_32BITS && (this.diskNumberStart = e2.readInt(4));
          }
        }, readExtraFields: function(e2) {
          var t2, r2, n2, i2 = e2.index + this.extraFieldsLength;
          for (this.extraFields || (this.extraFields = {}); e2.index + 4 < i2; ) t2 = e2.readInt(2), r2 = e2.readInt(2), n2 = e2.readData(r2), this.extraFields[t2] = { id: t2, length: r2, value: n2 };
          e2.setIndex(i2);
        }, handleUTF8: function() {
          var e2 = u.uint8array ? "uint8array" : "array";
          if (this.useUTF8()) this.fileNameStr = o.utf8decode(this.fileName), this.fileCommentStr = o.utf8decode(this.fileComment);
          else {
            var t2 = this.findExtraFieldUnicodePath();
            if (null !== t2) this.fileNameStr = t2;
            else {
              var r2 = s.transformTo(e2, this.fileName);
              this.fileNameStr = this.loadOptions.decodeFileName(r2);
            }
            var n2 = this.findExtraFieldUnicodeComment();
            if (null !== n2) this.fileCommentStr = n2;
            else {
              var i2 = s.transformTo(e2, this.fileComment);
              this.fileCommentStr = this.loadOptions.decodeFileName(i2);
            }
          }
        }, findExtraFieldUnicodePath: function() {
          var e2 = this.extraFields[28789];
          if (e2) {
            var t2 = n(e2.value);
            return 1 !== t2.readInt(1) ? null : a(this.fileName) !== t2.readInt(4) ? null : o.utf8decode(t2.readData(e2.length - 5));
          }
          return null;
        }, findExtraFieldUnicodeComment: function() {
          var e2 = this.extraFields[25461];
          if (e2) {
            var t2 = n(e2.value);
            return 1 !== t2.readInt(1) ? null : a(this.fileComment) !== t2.readInt(4) ? null : o.utf8decode(t2.readData(e2.length - 5));
          }
          return null;
        } }, t.exports = l;
      }, { "./compressedObject": 2, "./compressions": 3, "./crc32": 4, "./reader/readerFor": 22, "./support": 30, "./utf8": 31, "./utils": 32 }], 35: [function(e, t, r) {
        "use strict";
        function n(e2, t2, r2) {
          this.name = e2, this.dir = r2.dir, this.date = r2.date, this.comment = r2.comment, this.unixPermissions = r2.unixPermissions, this.dosPermissions = r2.dosPermissions, this._data = t2, this._dataBinary = r2.binary, this.options = { compression: r2.compression, compressionOptions: r2.compressionOptions };
        }
        var s = e("./stream/StreamHelper"), i = e("./stream/DataWorker"), a = e("./utf8"), o = e("./compressedObject"), h = e("./stream/GenericWorker");
        n.prototype = { internalStream: function(e2) {
          var t2 = null, r2 = "string";
          try {
            if (!e2) throw new Error("No output type specified.");
            var n2 = "string" === (r2 = e2.toLowerCase()) || "text" === r2;
            "binarystring" !== r2 && "text" !== r2 || (r2 = "string"), t2 = this._decompressWorker();
            var i2 = !this._dataBinary;
            i2 && !n2 && (t2 = t2.pipe(new a.Utf8EncodeWorker())), !i2 && n2 && (t2 = t2.pipe(new a.Utf8DecodeWorker()));
          } catch (e3) {
            (t2 = new h("error")).error(e3);
          }
          return new s(t2, r2, "");
        }, async: function(e2, t2) {
          return this.internalStream(e2).accumulate(t2);
        }, nodeStream: function(e2, t2) {
          return this.internalStream(e2 || "nodebuffer").toNodejsStream(t2);
        }, _compressWorker: function(e2, t2) {
          if (this._data instanceof o && this._data.compression.magic === e2.magic) return this._data.getCompressedWorker();
          var r2 = this._decompressWorker();
          return this._dataBinary || (r2 = r2.pipe(new a.Utf8EncodeWorker())), o.createWorkerFrom(r2, e2, t2);
        }, _decompressWorker: function() {
          return this._data instanceof o ? this._data.getContentWorker() : this._data instanceof h ? this._data : new i(this._data);
        } };
        for (var u = ["asText", "asBinary", "asNodeBuffer", "asUint8Array", "asArrayBuffer"], l = function() {
          throw new Error("This method has been removed in JSZip 3.0, please check the upgrade guide.");
        }, f = 0; f < u.length; f++) n.prototype[u[f]] = l;
        t.exports = n;
      }, { "./compressedObject": 2, "./stream/DataWorker": 27, "./stream/GenericWorker": 28, "./stream/StreamHelper": 29, "./utf8": 31 }], 36: [function(e, l, t) {
        (function(t2) {
          "use strict";
          var r, n, e2 = t2.MutationObserver || t2.WebKitMutationObserver;
          if (e2) {
            var i = 0, s = new e2(u), a = t2.document.createTextNode("");
            s.observe(a, { characterData: true }), r = function() {
              a.data = i = ++i % 2;
            };
          } else if (t2.setImmediate || void 0 === t2.MessageChannel) r = "document" in t2 && "onreadystatechange" in t2.document.createElement("script") ? function() {
            var e3 = t2.document.createElement("script");
            e3.onreadystatechange = function() {
              u(), e3.onreadystatechange = null, e3.parentNode.removeChild(e3), e3 = null;
            }, t2.document.documentElement.appendChild(e3);
          } : function() {
            setTimeout(u, 0);
          };
          else {
            var o = new t2.MessageChannel();
            o.port1.onmessage = u, r = function() {
              o.port2.postMessage(0);
            };
          }
          var h = [];
          function u() {
            var e3, t3;
            n = true;
            for (var r2 = h.length; r2; ) {
              for (t3 = h, h = [], e3 = -1; ++e3 < r2; ) t3[e3]();
              r2 = h.length;
            }
            n = false;
          }
          l.exports = function(e3) {
            1 !== h.push(e3) || n || r();
          };
        }).call(this, "undefined" != typeof global ? global : "undefined" != typeof self ? self : "undefined" != typeof window ? window : {});
      }, {}], 37: [function(e, t, r) {
        "use strict";
        var i = e("immediate");
        function u() {
        }
        var l = {}, s = ["REJECTED"], a = ["FULFILLED"], n = ["PENDING"];
        function o(e2) {
          if ("function" != typeof e2) throw new TypeError("resolver must be a function");
          this.state = n, this.queue = [], this.outcome = void 0, e2 !== u && d(this, e2);
        }
        function h(e2, t2, r2) {
          this.promise = e2, "function" == typeof t2 && (this.onFulfilled = t2, this.callFulfilled = this.otherCallFulfilled), "function" == typeof r2 && (this.onRejected = r2, this.callRejected = this.otherCallRejected);
        }
        function f(t2, r2, n2) {
          i(function() {
            var e2;
            try {
              e2 = r2(n2);
            } catch (e3) {
              return l.reject(t2, e3);
            }
            e2 === t2 ? l.reject(t2, new TypeError("Cannot resolve promise with itself")) : l.resolve(t2, e2);
          });
        }
        function c(e2) {
          var t2 = e2 && e2.then;
          if (e2 && ("object" == typeof e2 || "function" == typeof e2) && "function" == typeof t2) return function() {
            t2.apply(e2, arguments);
          };
        }
        function d(t2, e2) {
          var r2 = false;
          function n2(e3) {
            r2 || (r2 = true, l.reject(t2, e3));
          }
          function i2(e3) {
            r2 || (r2 = true, l.resolve(t2, e3));
          }
          var s2 = p(function() {
            e2(i2, n2);
          });
          "error" === s2.status && n2(s2.value);
        }
        function p(e2, t2) {
          var r2 = {};
          try {
            r2.value = e2(t2), r2.status = "success";
          } catch (e3) {
            r2.status = "error", r2.value = e3;
          }
          return r2;
        }
        (t.exports = o).prototype.finally = function(t2) {
          if ("function" != typeof t2) return this;
          var r2 = this.constructor;
          return this.then(function(e2) {
            return r2.resolve(t2()).then(function() {
              return e2;
            });
          }, function(e2) {
            return r2.resolve(t2()).then(function() {
              throw e2;
            });
          });
        }, o.prototype.catch = function(e2) {
          return this.then(null, e2);
        }, o.prototype.then = function(e2, t2) {
          if ("function" != typeof e2 && this.state === a || "function" != typeof t2 && this.state === s) return this;
          var r2 = new this.constructor(u);
          this.state !== n ? f(r2, this.state === a ? e2 : t2, this.outcome) : this.queue.push(new h(r2, e2, t2));
          return r2;
        }, h.prototype.callFulfilled = function(e2) {
          l.resolve(this.promise, e2);
        }, h.prototype.otherCallFulfilled = function(e2) {
          f(this.promise, this.onFulfilled, e2);
        }, h.prototype.callRejected = function(e2) {
          l.reject(this.promise, e2);
        }, h.prototype.otherCallRejected = function(e2) {
          f(this.promise, this.onRejected, e2);
        }, l.resolve = function(e2, t2) {
          var r2 = p(c, t2);
          if ("error" === r2.status) return l.reject(e2, r2.value);
          var n2 = r2.value;
          if (n2) d(e2, n2);
          else {
            e2.state = a, e2.outcome = t2;
            for (var i2 = -1, s2 = e2.queue.length; ++i2 < s2; ) e2.queue[i2].callFulfilled(t2);
          }
          return e2;
        }, l.reject = function(e2, t2) {
          e2.state = s, e2.outcome = t2;
          for (var r2 = -1, n2 = e2.queue.length; ++r2 < n2; ) e2.queue[r2].callRejected(t2);
          return e2;
        }, o.resolve = function(e2) {
          if (e2 instanceof this) return e2;
          return l.resolve(new this(u), e2);
        }, o.reject = function(e2) {
          var t2 = new this(u);
          return l.reject(t2, e2);
        }, o.all = function(e2) {
          var r2 = this;
          if ("[object Array]" !== Object.prototype.toString.call(e2)) return this.reject(new TypeError("must be an array"));
          var n2 = e2.length, i2 = false;
          if (!n2) return this.resolve([]);
          var s2 = new Array(n2), a2 = 0, t2 = -1, o2 = new this(u);
          for (; ++t2 < n2; ) h2(e2[t2], t2);
          return o2;
          function h2(e3, t3) {
            r2.resolve(e3).then(function(e4) {
              s2[t3] = e4, ++a2 !== n2 || i2 || (i2 = true, l.resolve(o2, s2));
            }, function(e4) {
              i2 || (i2 = true, l.reject(o2, e4));
            });
          }
        }, o.race = function(e2) {
          var t2 = this;
          if ("[object Array]" !== Object.prototype.toString.call(e2)) return this.reject(new TypeError("must be an array"));
          var r2 = e2.length, n2 = false;
          if (!r2) return this.resolve([]);
          var i2 = -1, s2 = new this(u);
          for (; ++i2 < r2; ) a2 = e2[i2], t2.resolve(a2).then(function(e3) {
            n2 || (n2 = true, l.resolve(s2, e3));
          }, function(e3) {
            n2 || (n2 = true, l.reject(s2, e3));
          });
          var a2;
          return s2;
        };
      }, { immediate: 36 }], 38: [function(e, t, r) {
        "use strict";
        var n = {};
        (0, e("./lib/utils/common").assign)(n, e("./lib/deflate"), e("./lib/inflate"), e("./lib/zlib/constants")), t.exports = n;
      }, { "./lib/deflate": 39, "./lib/inflate": 40, "./lib/utils/common": 41, "./lib/zlib/constants": 44 }], 39: [function(e, t, r) {
        "use strict";
        var a = e("./zlib/deflate"), o = e("./utils/common"), h = e("./utils/strings"), i = e("./zlib/messages"), s = e("./zlib/zstream"), u = Object.prototype.toString, l = 0, f = -1, c = 0, d = 8;
        function p(e2) {
          if (!(this instanceof p)) return new p(e2);
          this.options = o.assign({ level: f, method: d, chunkSize: 16384, windowBits: 15, memLevel: 8, strategy: c, to: "" }, e2 || {});
          var t2 = this.options;
          t2.raw && 0 < t2.windowBits ? t2.windowBits = -t2.windowBits : t2.gzip && 0 < t2.windowBits && t2.windowBits < 16 && (t2.windowBits += 16), this.err = 0, this.msg = "", this.ended = false, this.chunks = [], this.strm = new s(), this.strm.avail_out = 0;
          var r2 = a.deflateInit2(this.strm, t2.level, t2.method, t2.windowBits, t2.memLevel, t2.strategy);
          if (r2 !== l) throw new Error(i[r2]);
          if (t2.header && a.deflateSetHeader(this.strm, t2.header), t2.dictionary) {
            var n2;
            if (n2 = "string" == typeof t2.dictionary ? h.string2buf(t2.dictionary) : "[object ArrayBuffer]" === u.call(t2.dictionary) ? new Uint8Array(t2.dictionary) : t2.dictionary, (r2 = a.deflateSetDictionary(this.strm, n2)) !== l) throw new Error(i[r2]);
            this._dict_set = true;
          }
        }
        function n(e2, t2) {
          var r2 = new p(t2);
          if (r2.push(e2, true), r2.err) throw r2.msg || i[r2.err];
          return r2.result;
        }
        p.prototype.push = function(e2, t2) {
          var r2, n2, i2 = this.strm, s2 = this.options.chunkSize;
          if (this.ended) return false;
          n2 = t2 === ~~t2 ? t2 : true === t2 ? 4 : 0, "string" == typeof e2 ? i2.input = h.string2buf(e2) : "[object ArrayBuffer]" === u.call(e2) ? i2.input = new Uint8Array(e2) : i2.input = e2, i2.next_in = 0, i2.avail_in = i2.input.length;
          do {
            if (0 === i2.avail_out && (i2.output = new o.Buf8(s2), i2.next_out = 0, i2.avail_out = s2), 1 !== (r2 = a.deflate(i2, n2)) && r2 !== l) return this.onEnd(r2), !(this.ended = true);
            0 !== i2.avail_out && (0 !== i2.avail_in || 4 !== n2 && 2 !== n2) || ("string" === this.options.to ? this.onData(h.buf2binstring(o.shrinkBuf(i2.output, i2.next_out))) : this.onData(o.shrinkBuf(i2.output, i2.next_out)));
          } while ((0 < i2.avail_in || 0 === i2.avail_out) && 1 !== r2);
          return 4 === n2 ? (r2 = a.deflateEnd(this.strm), this.onEnd(r2), this.ended = true, r2 === l) : 2 !== n2 || (this.onEnd(l), !(i2.avail_out = 0));
        }, p.prototype.onData = function(e2) {
          this.chunks.push(e2);
        }, p.prototype.onEnd = function(e2) {
          e2 === l && ("string" === this.options.to ? this.result = this.chunks.join("") : this.result = o.flattenChunks(this.chunks)), this.chunks = [], this.err = e2, this.msg = this.strm.msg;
        }, r.Deflate = p, r.deflate = n, r.deflateRaw = function(e2, t2) {
          return (t2 = t2 || {}).raw = true, n(e2, t2);
        }, r.gzip = function(e2, t2) {
          return (t2 = t2 || {}).gzip = true, n(e2, t2);
        };
      }, { "./utils/common": 41, "./utils/strings": 42, "./zlib/deflate": 46, "./zlib/messages": 51, "./zlib/zstream": 53 }], 40: [function(e, t, r) {
        "use strict";
        var c = e("./zlib/inflate"), d = e("./utils/common"), p = e("./utils/strings"), m = e("./zlib/constants"), n = e("./zlib/messages"), i = e("./zlib/zstream"), s = e("./zlib/gzheader"), _ = Object.prototype.toString;
        function a(e2) {
          if (!(this instanceof a)) return new a(e2);
          this.options = d.assign({ chunkSize: 16384, windowBits: 0, to: "" }, e2 || {});
          var t2 = this.options;
          t2.raw && 0 <= t2.windowBits && t2.windowBits < 16 && (t2.windowBits = -t2.windowBits, 0 === t2.windowBits && (t2.windowBits = -15)), !(0 <= t2.windowBits && t2.windowBits < 16) || e2 && e2.windowBits || (t2.windowBits += 32), 15 < t2.windowBits && t2.windowBits < 48 && 0 == (15 & t2.windowBits) && (t2.windowBits |= 15), this.err = 0, this.msg = "", this.ended = false, this.chunks = [], this.strm = new i(), this.strm.avail_out = 0;
          var r2 = c.inflateInit2(this.strm, t2.windowBits);
          if (r2 !== m.Z_OK) throw new Error(n[r2]);
          this.header = new s(), c.inflateGetHeader(this.strm, this.header);
        }
        function o(e2, t2) {
          var r2 = new a(t2);
          if (r2.push(e2, true), r2.err) throw r2.msg || n[r2.err];
          return r2.result;
        }
        a.prototype.push = function(e2, t2) {
          var r2, n2, i2, s2, a2, o2, h = this.strm, u = this.options.chunkSize, l = this.options.dictionary, f = false;
          if (this.ended) return false;
          n2 = t2 === ~~t2 ? t2 : true === t2 ? m.Z_FINISH : m.Z_NO_FLUSH, "string" == typeof e2 ? h.input = p.binstring2buf(e2) : "[object ArrayBuffer]" === _.call(e2) ? h.input = new Uint8Array(e2) : h.input = e2, h.next_in = 0, h.avail_in = h.input.length;
          do {
            if (0 === h.avail_out && (h.output = new d.Buf8(u), h.next_out = 0, h.avail_out = u), (r2 = c.inflate(h, m.Z_NO_FLUSH)) === m.Z_NEED_DICT && l && (o2 = "string" == typeof l ? p.string2buf(l) : "[object ArrayBuffer]" === _.call(l) ? new Uint8Array(l) : l, r2 = c.inflateSetDictionary(this.strm, o2)), r2 === m.Z_BUF_ERROR && true === f && (r2 = m.Z_OK, f = false), r2 !== m.Z_STREAM_END && r2 !== m.Z_OK) return this.onEnd(r2), !(this.ended = true);
            h.next_out && (0 !== h.avail_out && r2 !== m.Z_STREAM_END && (0 !== h.avail_in || n2 !== m.Z_FINISH && n2 !== m.Z_SYNC_FLUSH) || ("string" === this.options.to ? (i2 = p.utf8border(h.output, h.next_out), s2 = h.next_out - i2, a2 = p.buf2string(h.output, i2), h.next_out = s2, h.avail_out = u - s2, s2 && d.arraySet(h.output, h.output, i2, s2, 0), this.onData(a2)) : this.onData(d.shrinkBuf(h.output, h.next_out)))), 0 === h.avail_in && 0 === h.avail_out && (f = true);
          } while ((0 < h.avail_in || 0 === h.avail_out) && r2 !== m.Z_STREAM_END);
          return r2 === m.Z_STREAM_END && (n2 = m.Z_FINISH), n2 === m.Z_FINISH ? (r2 = c.inflateEnd(this.strm), this.onEnd(r2), this.ended = true, r2 === m.Z_OK) : n2 !== m.Z_SYNC_FLUSH || (this.onEnd(m.Z_OK), !(h.avail_out = 0));
        }, a.prototype.onData = function(e2) {
          this.chunks.push(e2);
        }, a.prototype.onEnd = function(e2) {
          e2 === m.Z_OK && ("string" === this.options.to ? this.result = this.chunks.join("") : this.result = d.flattenChunks(this.chunks)), this.chunks = [], this.err = e2, this.msg = this.strm.msg;
        }, r.Inflate = a, r.inflate = o, r.inflateRaw = function(e2, t2) {
          return (t2 = t2 || {}).raw = true, o(e2, t2);
        }, r.ungzip = o;
      }, { "./utils/common": 41, "./utils/strings": 42, "./zlib/constants": 44, "./zlib/gzheader": 47, "./zlib/inflate": 49, "./zlib/messages": 51, "./zlib/zstream": 53 }], 41: [function(e, t, r) {
        "use strict";
        var n = "undefined" != typeof Uint8Array && "undefined" != typeof Uint16Array && "undefined" != typeof Int32Array;
        r.assign = function(e2) {
          for (var t2 = Array.prototype.slice.call(arguments, 1); t2.length; ) {
            var r2 = t2.shift();
            if (r2) {
              if ("object" != typeof r2) throw new TypeError(r2 + "must be non-object");
              for (var n2 in r2) r2.hasOwnProperty(n2) && (e2[n2] = r2[n2]);
            }
          }
          return e2;
        }, r.shrinkBuf = function(e2, t2) {
          return e2.length === t2 ? e2 : e2.subarray ? e2.subarray(0, t2) : (e2.length = t2, e2);
        };
        var i = { arraySet: function(e2, t2, r2, n2, i2) {
          if (t2.subarray && e2.subarray) e2.set(t2.subarray(r2, r2 + n2), i2);
          else for (var s2 = 0; s2 < n2; s2++) e2[i2 + s2] = t2[r2 + s2];
        }, flattenChunks: function(e2) {
          var t2, r2, n2, i2, s2, a;
          for (t2 = n2 = 0, r2 = e2.length; t2 < r2; t2++) n2 += e2[t2].length;
          for (a = new Uint8Array(n2), t2 = i2 = 0, r2 = e2.length; t2 < r2; t2++) s2 = e2[t2], a.set(s2, i2), i2 += s2.length;
          return a;
        } }, s = { arraySet: function(e2, t2, r2, n2, i2) {
          for (var s2 = 0; s2 < n2; s2++) e2[i2 + s2] = t2[r2 + s2];
        }, flattenChunks: function(e2) {
          return [].concat.apply([], e2);
        } };
        r.setTyped = function(e2) {
          e2 ? (r.Buf8 = Uint8Array, r.Buf16 = Uint16Array, r.Buf32 = Int32Array, r.assign(r, i)) : (r.Buf8 = Array, r.Buf16 = Array, r.Buf32 = Array, r.assign(r, s));
        }, r.setTyped(n);
      }, {}], 42: [function(e, t, r) {
        "use strict";
        var h = e("./common"), i = true, s = true;
        try {
          String.fromCharCode.apply(null, [0]);
        } catch (e2) {
          i = false;
        }
        try {
          String.fromCharCode.apply(null, new Uint8Array(1));
        } catch (e2) {
          s = false;
        }
        for (var u = new h.Buf8(256), n = 0; n < 256; n++) u[n] = 252 <= n ? 6 : 248 <= n ? 5 : 240 <= n ? 4 : 224 <= n ? 3 : 192 <= n ? 2 : 1;
        function l(e2, t2) {
          if (t2 < 65537 && (e2.subarray && s || !e2.subarray && i)) return String.fromCharCode.apply(null, h.shrinkBuf(e2, t2));
          for (var r2 = "", n2 = 0; n2 < t2; n2++) r2 += String.fromCharCode(e2[n2]);
          return r2;
        }
        u[254] = u[254] = 1, r.string2buf = function(e2) {
          var t2, r2, n2, i2, s2, a = e2.length, o = 0;
          for (i2 = 0; i2 < a; i2++) 55296 == (64512 & (r2 = e2.charCodeAt(i2))) && i2 + 1 < a && 56320 == (64512 & (n2 = e2.charCodeAt(i2 + 1))) && (r2 = 65536 + (r2 - 55296 << 10) + (n2 - 56320), i2++), o += r2 < 128 ? 1 : r2 < 2048 ? 2 : r2 < 65536 ? 3 : 4;
          for (t2 = new h.Buf8(o), i2 = s2 = 0; s2 < o; i2++) 55296 == (64512 & (r2 = e2.charCodeAt(i2))) && i2 + 1 < a && 56320 == (64512 & (n2 = e2.charCodeAt(i2 + 1))) && (r2 = 65536 + (r2 - 55296 << 10) + (n2 - 56320), i2++), r2 < 128 ? t2[s2++] = r2 : (r2 < 2048 ? t2[s2++] = 192 | r2 >>> 6 : (r2 < 65536 ? t2[s2++] = 224 | r2 >>> 12 : (t2[s2++] = 240 | r2 >>> 18, t2[s2++] = 128 | r2 >>> 12 & 63), t2[s2++] = 128 | r2 >>> 6 & 63), t2[s2++] = 128 | 63 & r2);
          return t2;
        }, r.buf2binstring = function(e2) {
          return l(e2, e2.length);
        }, r.binstring2buf = function(e2) {
          for (var t2 = new h.Buf8(e2.length), r2 = 0, n2 = t2.length; r2 < n2; r2++) t2[r2] = e2.charCodeAt(r2);
          return t2;
        }, r.buf2string = function(e2, t2) {
          var r2, n2, i2, s2, a = t2 || e2.length, o = new Array(2 * a);
          for (r2 = n2 = 0; r2 < a; ) if ((i2 = e2[r2++]) < 128) o[n2++] = i2;
          else if (4 < (s2 = u[i2])) o[n2++] = 65533, r2 += s2 - 1;
          else {
            for (i2 &= 2 === s2 ? 31 : 3 === s2 ? 15 : 7; 1 < s2 && r2 < a; ) i2 = i2 << 6 | 63 & e2[r2++], s2--;
            1 < s2 ? o[n2++] = 65533 : i2 < 65536 ? o[n2++] = i2 : (i2 -= 65536, o[n2++] = 55296 | i2 >> 10 & 1023, o[n2++] = 56320 | 1023 & i2);
          }
          return l(o, n2);
        }, r.utf8border = function(e2, t2) {
          var r2;
          for ((t2 = t2 || e2.length) > e2.length && (t2 = e2.length), r2 = t2 - 1; 0 <= r2 && 128 == (192 & e2[r2]); ) r2--;
          return r2 < 0 ? t2 : 0 === r2 ? t2 : r2 + u[e2[r2]] > t2 ? r2 : t2;
        };
      }, { "./common": 41 }], 43: [function(e, t, r) {
        "use strict";
        t.exports = function(e2, t2, r2, n) {
          for (var i = 65535 & e2 | 0, s = e2 >>> 16 & 65535 | 0, a = 0; 0 !== r2; ) {
            for (r2 -= a = 2e3 < r2 ? 2e3 : r2; s = s + (i = i + t2[n++] | 0) | 0, --a; ) ;
            i %= 65521, s %= 65521;
          }
          return i | s << 16 | 0;
        };
      }, {}], 44: [function(e, t, r) {
        "use strict";
        t.exports = { Z_NO_FLUSH: 0, Z_PARTIAL_FLUSH: 1, Z_SYNC_FLUSH: 2, Z_FULL_FLUSH: 3, Z_FINISH: 4, Z_BLOCK: 5, Z_TREES: 6, Z_OK: 0, Z_STREAM_END: 1, Z_NEED_DICT: 2, Z_ERRNO: -1, Z_STREAM_ERROR: -2, Z_DATA_ERROR: -3, Z_BUF_ERROR: -5, Z_NO_COMPRESSION: 0, Z_BEST_SPEED: 1, Z_BEST_COMPRESSION: 9, Z_DEFAULT_COMPRESSION: -1, Z_FILTERED: 1, Z_HUFFMAN_ONLY: 2, Z_RLE: 3, Z_FIXED: 4, Z_DEFAULT_STRATEGY: 0, Z_BINARY: 0, Z_TEXT: 1, Z_UNKNOWN: 2, Z_DEFLATED: 8 };
      }, {}], 45: [function(e, t, r) {
        "use strict";
        var o = (function() {
          for (var e2, t2 = [], r2 = 0; r2 < 256; r2++) {
            e2 = r2;
            for (var n = 0; n < 8; n++) e2 = 1 & e2 ? 3988292384 ^ e2 >>> 1 : e2 >>> 1;
            t2[r2] = e2;
          }
          return t2;
        })();
        t.exports = function(e2, t2, r2, n) {
          var i = o, s = n + r2;
          e2 ^= -1;
          for (var a = n; a < s; a++) e2 = e2 >>> 8 ^ i[255 & (e2 ^ t2[a])];
          return -1 ^ e2;
        };
      }, {}], 46: [function(e, t, r) {
        "use strict";
        var h, c = e("../utils/common"), u = e("./trees"), d = e("./adler32"), p = e("./crc32"), n = e("./messages"), l = 0, f = 4, m = 0, _ = -2, g = -1, b = 4, i = 2, v = 8, y = 9, s = 286, a = 30, o = 19, w = 2 * s + 1, k = 15, x = 3, S = 258, z = S + x + 1, C = 42, E = 113, A = 1, I = 2, O = 3, B = 4;
        function R(e2, t2) {
          return e2.msg = n[t2], t2;
        }
        function T(e2) {
          return (e2 << 1) - (4 < e2 ? 9 : 0);
        }
        function D(e2) {
          for (var t2 = e2.length; 0 <= --t2; ) e2[t2] = 0;
        }
        function F(e2) {
          var t2 = e2.state, r2 = t2.pending;
          r2 > e2.avail_out && (r2 = e2.avail_out), 0 !== r2 && (c.arraySet(e2.output, t2.pending_buf, t2.pending_out, r2, e2.next_out), e2.next_out += r2, t2.pending_out += r2, e2.total_out += r2, e2.avail_out -= r2, t2.pending -= r2, 0 === t2.pending && (t2.pending_out = 0));
        }
        function N(e2, t2) {
          u._tr_flush_block(e2, 0 <= e2.block_start ? e2.block_start : -1, e2.strstart - e2.block_start, t2), e2.block_start = e2.strstart, F(e2.strm);
        }
        function U(e2, t2) {
          e2.pending_buf[e2.pending++] = t2;
        }
        function P(e2, t2) {
          e2.pending_buf[e2.pending++] = t2 >>> 8 & 255, e2.pending_buf[e2.pending++] = 255 & t2;
        }
        function L(e2, t2) {
          var r2, n2, i2 = e2.max_chain_length, s2 = e2.strstart, a2 = e2.prev_length, o2 = e2.nice_match, h2 = e2.strstart > e2.w_size - z ? e2.strstart - (e2.w_size - z) : 0, u2 = e2.window, l2 = e2.w_mask, f2 = e2.prev, c2 = e2.strstart + S, d2 = u2[s2 + a2 - 1], p2 = u2[s2 + a2];
          e2.prev_length >= e2.good_match && (i2 >>= 2), o2 > e2.lookahead && (o2 = e2.lookahead);
          do {
            if (u2[(r2 = t2) + a2] === p2 && u2[r2 + a2 - 1] === d2 && u2[r2] === u2[s2] && u2[++r2] === u2[s2 + 1]) {
              s2 += 2, r2++;
              do {
              } while (u2[++s2] === u2[++r2] && u2[++s2] === u2[++r2] && u2[++s2] === u2[++r2] && u2[++s2] === u2[++r2] && u2[++s2] === u2[++r2] && u2[++s2] === u2[++r2] && u2[++s2] === u2[++r2] && u2[++s2] === u2[++r2] && s2 < c2);
              if (n2 = S - (c2 - s2), s2 = c2 - S, a2 < n2) {
                if (e2.match_start = t2, o2 <= (a2 = n2)) break;
                d2 = u2[s2 + a2 - 1], p2 = u2[s2 + a2];
              }
            }
          } while ((t2 = f2[t2 & l2]) > h2 && 0 != --i2);
          return a2 <= e2.lookahead ? a2 : e2.lookahead;
        }
        function j(e2) {
          var t2, r2, n2, i2, s2, a2, o2, h2, u2, l2, f2 = e2.w_size;
          do {
            if (i2 = e2.window_size - e2.lookahead - e2.strstart, e2.strstart >= f2 + (f2 - z)) {
              for (c.arraySet(e2.window, e2.window, f2, f2, 0), e2.match_start -= f2, e2.strstart -= f2, e2.block_start -= f2, t2 = r2 = e2.hash_size; n2 = e2.head[--t2], e2.head[t2] = f2 <= n2 ? n2 - f2 : 0, --r2; ) ;
              for (t2 = r2 = f2; n2 = e2.prev[--t2], e2.prev[t2] = f2 <= n2 ? n2 - f2 : 0, --r2; ) ;
              i2 += f2;
            }
            if (0 === e2.strm.avail_in) break;
            if (a2 = e2.strm, o2 = e2.window, h2 = e2.strstart + e2.lookahead, u2 = i2, l2 = void 0, l2 = a2.avail_in, u2 < l2 && (l2 = u2), r2 = 0 === l2 ? 0 : (a2.avail_in -= l2, c.arraySet(o2, a2.input, a2.next_in, l2, h2), 1 === a2.state.wrap ? a2.adler = d(a2.adler, o2, l2, h2) : 2 === a2.state.wrap && (a2.adler = p(a2.adler, o2, l2, h2)), a2.next_in += l2, a2.total_in += l2, l2), e2.lookahead += r2, e2.lookahead + e2.insert >= x) for (s2 = e2.strstart - e2.insert, e2.ins_h = e2.window[s2], e2.ins_h = (e2.ins_h << e2.hash_shift ^ e2.window[s2 + 1]) & e2.hash_mask; e2.insert && (e2.ins_h = (e2.ins_h << e2.hash_shift ^ e2.window[s2 + x - 1]) & e2.hash_mask, e2.prev[s2 & e2.w_mask] = e2.head[e2.ins_h], e2.head[e2.ins_h] = s2, s2++, e2.insert--, !(e2.lookahead + e2.insert < x)); ) ;
          } while (e2.lookahead < z && 0 !== e2.strm.avail_in);
        }
        function Z(e2, t2) {
          for (var r2, n2; ; ) {
            if (e2.lookahead < z) {
              if (j(e2), e2.lookahead < z && t2 === l) return A;
              if (0 === e2.lookahead) break;
            }
            if (r2 = 0, e2.lookahead >= x && (e2.ins_h = (e2.ins_h << e2.hash_shift ^ e2.window[e2.strstart + x - 1]) & e2.hash_mask, r2 = e2.prev[e2.strstart & e2.w_mask] = e2.head[e2.ins_h], e2.head[e2.ins_h] = e2.strstart), 0 !== r2 && e2.strstart - r2 <= e2.w_size - z && (e2.match_length = L(e2, r2)), e2.match_length >= x) if (n2 = u._tr_tally(e2, e2.strstart - e2.match_start, e2.match_length - x), e2.lookahead -= e2.match_length, e2.match_length <= e2.max_lazy_match && e2.lookahead >= x) {
              for (e2.match_length--; e2.strstart++, e2.ins_h = (e2.ins_h << e2.hash_shift ^ e2.window[e2.strstart + x - 1]) & e2.hash_mask, r2 = e2.prev[e2.strstart & e2.w_mask] = e2.head[e2.ins_h], e2.head[e2.ins_h] = e2.strstart, 0 != --e2.match_length; ) ;
              e2.strstart++;
            } else e2.strstart += e2.match_length, e2.match_length = 0, e2.ins_h = e2.window[e2.strstart], e2.ins_h = (e2.ins_h << e2.hash_shift ^ e2.window[e2.strstart + 1]) & e2.hash_mask;
            else n2 = u._tr_tally(e2, 0, e2.window[e2.strstart]), e2.lookahead--, e2.strstart++;
            if (n2 && (N(e2, false), 0 === e2.strm.avail_out)) return A;
          }
          return e2.insert = e2.strstart < x - 1 ? e2.strstart : x - 1, t2 === f ? (N(e2, true), 0 === e2.strm.avail_out ? O : B) : e2.last_lit && (N(e2, false), 0 === e2.strm.avail_out) ? A : I;
        }
        function W(e2, t2) {
          for (var r2, n2, i2; ; ) {
            if (e2.lookahead < z) {
              if (j(e2), e2.lookahead < z && t2 === l) return A;
              if (0 === e2.lookahead) break;
            }
            if (r2 = 0, e2.lookahead >= x && (e2.ins_h = (e2.ins_h << e2.hash_shift ^ e2.window[e2.strstart + x - 1]) & e2.hash_mask, r2 = e2.prev[e2.strstart & e2.w_mask] = e2.head[e2.ins_h], e2.head[e2.ins_h] = e2.strstart), e2.prev_length = e2.match_length, e2.prev_match = e2.match_start, e2.match_length = x - 1, 0 !== r2 && e2.prev_length < e2.max_lazy_match && e2.strstart - r2 <= e2.w_size - z && (e2.match_length = L(e2, r2), e2.match_length <= 5 && (1 === e2.strategy || e2.match_length === x && 4096 < e2.strstart - e2.match_start) && (e2.match_length = x - 1)), e2.prev_length >= x && e2.match_length <= e2.prev_length) {
              for (i2 = e2.strstart + e2.lookahead - x, n2 = u._tr_tally(e2, e2.strstart - 1 - e2.prev_match, e2.prev_length - x), e2.lookahead -= e2.prev_length - 1, e2.prev_length -= 2; ++e2.strstart <= i2 && (e2.ins_h = (e2.ins_h << e2.hash_shift ^ e2.window[e2.strstart + x - 1]) & e2.hash_mask, r2 = e2.prev[e2.strstart & e2.w_mask] = e2.head[e2.ins_h], e2.head[e2.ins_h] = e2.strstart), 0 != --e2.prev_length; ) ;
              if (e2.match_available = 0, e2.match_length = x - 1, e2.strstart++, n2 && (N(e2, false), 0 === e2.strm.avail_out)) return A;
            } else if (e2.match_available) {
              if ((n2 = u._tr_tally(e2, 0, e2.window[e2.strstart - 1])) && N(e2, false), e2.strstart++, e2.lookahead--, 0 === e2.strm.avail_out) return A;
            } else e2.match_available = 1, e2.strstart++, e2.lookahead--;
          }
          return e2.match_available && (n2 = u._tr_tally(e2, 0, e2.window[e2.strstart - 1]), e2.match_available = 0), e2.insert = e2.strstart < x - 1 ? e2.strstart : x - 1, t2 === f ? (N(e2, true), 0 === e2.strm.avail_out ? O : B) : e2.last_lit && (N(e2, false), 0 === e2.strm.avail_out) ? A : I;
        }
        function M(e2, t2, r2, n2, i2) {
          this.good_length = e2, this.max_lazy = t2, this.nice_length = r2, this.max_chain = n2, this.func = i2;
        }
        function H() {
          this.strm = null, this.status = 0, this.pending_buf = null, this.pending_buf_size = 0, this.pending_out = 0, this.pending = 0, this.wrap = 0, this.gzhead = null, this.gzindex = 0, this.method = v, this.last_flush = -1, this.w_size = 0, this.w_bits = 0, this.w_mask = 0, this.window = null, this.window_size = 0, this.prev = null, this.head = null, this.ins_h = 0, this.hash_size = 0, this.hash_bits = 0, this.hash_mask = 0, this.hash_shift = 0, this.block_start = 0, this.match_length = 0, this.prev_match = 0, this.match_available = 0, this.strstart = 0, this.match_start = 0, this.lookahead = 0, this.prev_length = 0, this.max_chain_length = 0, this.max_lazy_match = 0, this.level = 0, this.strategy = 0, this.good_match = 0, this.nice_match = 0, this.dyn_ltree = new c.Buf16(2 * w), this.dyn_dtree = new c.Buf16(2 * (2 * a + 1)), this.bl_tree = new c.Buf16(2 * (2 * o + 1)), D(this.dyn_ltree), D(this.dyn_dtree), D(this.bl_tree), this.l_desc = null, this.d_desc = null, this.bl_desc = null, this.bl_count = new c.Buf16(k + 1), this.heap = new c.Buf16(2 * s + 1), D(this.heap), this.heap_len = 0, this.heap_max = 0, this.depth = new c.Buf16(2 * s + 1), D(this.depth), this.l_buf = 0, this.lit_bufsize = 0, this.last_lit = 0, this.d_buf = 0, this.opt_len = 0, this.static_len = 0, this.matches = 0, this.insert = 0, this.bi_buf = 0, this.bi_valid = 0;
        }
        function G(e2) {
          var t2;
          return e2 && e2.state ? (e2.total_in = e2.total_out = 0, e2.data_type = i, (t2 = e2.state).pending = 0, t2.pending_out = 0, t2.wrap < 0 && (t2.wrap = -t2.wrap), t2.status = t2.wrap ? C : E, e2.adler = 2 === t2.wrap ? 0 : 1, t2.last_flush = l, u._tr_init(t2), m) : R(e2, _);
        }
        function K(e2) {
          var t2 = G(e2);
          return t2 === m && (function(e3) {
            e3.window_size = 2 * e3.w_size, D(e3.head), e3.max_lazy_match = h[e3.level].max_lazy, e3.good_match = h[e3.level].good_length, e3.nice_match = h[e3.level].nice_length, e3.max_chain_length = h[e3.level].max_chain, e3.strstart = 0, e3.block_start = 0, e3.lookahead = 0, e3.insert = 0, e3.match_length = e3.prev_length = x - 1, e3.match_available = 0, e3.ins_h = 0;
          })(e2.state), t2;
        }
        function Y(e2, t2, r2, n2, i2, s2) {
          if (!e2) return _;
          var a2 = 1;
          if (t2 === g && (t2 = 6), n2 < 0 ? (a2 = 0, n2 = -n2) : 15 < n2 && (a2 = 2, n2 -= 16), i2 < 1 || y < i2 || r2 !== v || n2 < 8 || 15 < n2 || t2 < 0 || 9 < t2 || s2 < 0 || b < s2) return R(e2, _);
          8 === n2 && (n2 = 9);
          var o2 = new H();
          return (e2.state = o2).strm = e2, o2.wrap = a2, o2.gzhead = null, o2.w_bits = n2, o2.w_size = 1 << o2.w_bits, o2.w_mask = o2.w_size - 1, o2.hash_bits = i2 + 7, o2.hash_size = 1 << o2.hash_bits, o2.hash_mask = o2.hash_size - 1, o2.hash_shift = ~~((o2.hash_bits + x - 1) / x), o2.window = new c.Buf8(2 * o2.w_size), o2.head = new c.Buf16(o2.hash_size), o2.prev = new c.Buf16(o2.w_size), o2.lit_bufsize = 1 << i2 + 6, o2.pending_buf_size = 4 * o2.lit_bufsize, o2.pending_buf = new c.Buf8(o2.pending_buf_size), o2.d_buf = 1 * o2.lit_bufsize, o2.l_buf = 3 * o2.lit_bufsize, o2.level = t2, o2.strategy = s2, o2.method = r2, K(e2);
        }
        h = [new M(0, 0, 0, 0, function(e2, t2) {
          var r2 = 65535;
          for (r2 > e2.pending_buf_size - 5 && (r2 = e2.pending_buf_size - 5); ; ) {
            if (e2.lookahead <= 1) {
              if (j(e2), 0 === e2.lookahead && t2 === l) return A;
              if (0 === e2.lookahead) break;
            }
            e2.strstart += e2.lookahead, e2.lookahead = 0;
            var n2 = e2.block_start + r2;
            if ((0 === e2.strstart || e2.strstart >= n2) && (e2.lookahead = e2.strstart - n2, e2.strstart = n2, N(e2, false), 0 === e2.strm.avail_out)) return A;
            if (e2.strstart - e2.block_start >= e2.w_size - z && (N(e2, false), 0 === e2.strm.avail_out)) return A;
          }
          return e2.insert = 0, t2 === f ? (N(e2, true), 0 === e2.strm.avail_out ? O : B) : (e2.strstart > e2.block_start && (N(e2, false), e2.strm.avail_out), A);
        }), new M(4, 4, 8, 4, Z), new M(4, 5, 16, 8, Z), new M(4, 6, 32, 32, Z), new M(4, 4, 16, 16, W), new M(8, 16, 32, 32, W), new M(8, 16, 128, 128, W), new M(8, 32, 128, 256, W), new M(32, 128, 258, 1024, W), new M(32, 258, 258, 4096, W)], r.deflateInit = function(e2, t2) {
          return Y(e2, t2, v, 15, 8, 0);
        }, r.deflateInit2 = Y, r.deflateReset = K, r.deflateResetKeep = G, r.deflateSetHeader = function(e2, t2) {
          return e2 && e2.state ? 2 !== e2.state.wrap ? _ : (e2.state.gzhead = t2, m) : _;
        }, r.deflate = function(e2, t2) {
          var r2, n2, i2, s2;
          if (!e2 || !e2.state || 5 < t2 || t2 < 0) return e2 ? R(e2, _) : _;
          if (n2 = e2.state, !e2.output || !e2.input && 0 !== e2.avail_in || 666 === n2.status && t2 !== f) return R(e2, 0 === e2.avail_out ? -5 : _);
          if (n2.strm = e2, r2 = n2.last_flush, n2.last_flush = t2, n2.status === C) if (2 === n2.wrap) e2.adler = 0, U(n2, 31), U(n2, 139), U(n2, 8), n2.gzhead ? (U(n2, (n2.gzhead.text ? 1 : 0) + (n2.gzhead.hcrc ? 2 : 0) + (n2.gzhead.extra ? 4 : 0) + (n2.gzhead.name ? 8 : 0) + (n2.gzhead.comment ? 16 : 0)), U(n2, 255 & n2.gzhead.time), U(n2, n2.gzhead.time >> 8 & 255), U(n2, n2.gzhead.time >> 16 & 255), U(n2, n2.gzhead.time >> 24 & 255), U(n2, 9 === n2.level ? 2 : 2 <= n2.strategy || n2.level < 2 ? 4 : 0), U(n2, 255 & n2.gzhead.os), n2.gzhead.extra && n2.gzhead.extra.length && (U(n2, 255 & n2.gzhead.extra.length), U(n2, n2.gzhead.extra.length >> 8 & 255)), n2.gzhead.hcrc && (e2.adler = p(e2.adler, n2.pending_buf, n2.pending, 0)), n2.gzindex = 0, n2.status = 69) : (U(n2, 0), U(n2, 0), U(n2, 0), U(n2, 0), U(n2, 0), U(n2, 9 === n2.level ? 2 : 2 <= n2.strategy || n2.level < 2 ? 4 : 0), U(n2, 3), n2.status = E);
          else {
            var a2 = v + (n2.w_bits - 8 << 4) << 8;
            a2 |= (2 <= n2.strategy || n2.level < 2 ? 0 : n2.level < 6 ? 1 : 6 === n2.level ? 2 : 3) << 6, 0 !== n2.strstart && (a2 |= 32), a2 += 31 - a2 % 31, n2.status = E, P(n2, a2), 0 !== n2.strstart && (P(n2, e2.adler >>> 16), P(n2, 65535 & e2.adler)), e2.adler = 1;
          }
          if (69 === n2.status) if (n2.gzhead.extra) {
            for (i2 = n2.pending; n2.gzindex < (65535 & n2.gzhead.extra.length) && (n2.pending !== n2.pending_buf_size || (n2.gzhead.hcrc && n2.pending > i2 && (e2.adler = p(e2.adler, n2.pending_buf, n2.pending - i2, i2)), F(e2), i2 = n2.pending, n2.pending !== n2.pending_buf_size)); ) U(n2, 255 & n2.gzhead.extra[n2.gzindex]), n2.gzindex++;
            n2.gzhead.hcrc && n2.pending > i2 && (e2.adler = p(e2.adler, n2.pending_buf, n2.pending - i2, i2)), n2.gzindex === n2.gzhead.extra.length && (n2.gzindex = 0, n2.status = 73);
          } else n2.status = 73;
          if (73 === n2.status) if (n2.gzhead.name) {
            i2 = n2.pending;
            do {
              if (n2.pending === n2.pending_buf_size && (n2.gzhead.hcrc && n2.pending > i2 && (e2.adler = p(e2.adler, n2.pending_buf, n2.pending - i2, i2)), F(e2), i2 = n2.pending, n2.pending === n2.pending_buf_size)) {
                s2 = 1;
                break;
              }
              s2 = n2.gzindex < n2.gzhead.name.length ? 255 & n2.gzhead.name.charCodeAt(n2.gzindex++) : 0, U(n2, s2);
            } while (0 !== s2);
            n2.gzhead.hcrc && n2.pending > i2 && (e2.adler = p(e2.adler, n2.pending_buf, n2.pending - i2, i2)), 0 === s2 && (n2.gzindex = 0, n2.status = 91);
          } else n2.status = 91;
          if (91 === n2.status) if (n2.gzhead.comment) {
            i2 = n2.pending;
            do {
              if (n2.pending === n2.pending_buf_size && (n2.gzhead.hcrc && n2.pending > i2 && (e2.adler = p(e2.adler, n2.pending_buf, n2.pending - i2, i2)), F(e2), i2 = n2.pending, n2.pending === n2.pending_buf_size)) {
                s2 = 1;
                break;
              }
              s2 = n2.gzindex < n2.gzhead.comment.length ? 255 & n2.gzhead.comment.charCodeAt(n2.gzindex++) : 0, U(n2, s2);
            } while (0 !== s2);
            n2.gzhead.hcrc && n2.pending > i2 && (e2.adler = p(e2.adler, n2.pending_buf, n2.pending - i2, i2)), 0 === s2 && (n2.status = 103);
          } else n2.status = 103;
          if (103 === n2.status && (n2.gzhead.hcrc ? (n2.pending + 2 > n2.pending_buf_size && F(e2), n2.pending + 2 <= n2.pending_buf_size && (U(n2, 255 & e2.adler), U(n2, e2.adler >> 8 & 255), e2.adler = 0, n2.status = E)) : n2.status = E), 0 !== n2.pending) {
            if (F(e2), 0 === e2.avail_out) return n2.last_flush = -1, m;
          } else if (0 === e2.avail_in && T(t2) <= T(r2) && t2 !== f) return R(e2, -5);
          if (666 === n2.status && 0 !== e2.avail_in) return R(e2, -5);
          if (0 !== e2.avail_in || 0 !== n2.lookahead || t2 !== l && 666 !== n2.status) {
            var o2 = 2 === n2.strategy ? (function(e3, t3) {
              for (var r3; ; ) {
                if (0 === e3.lookahead && (j(e3), 0 === e3.lookahead)) {
                  if (t3 === l) return A;
                  break;
                }
                if (e3.match_length = 0, r3 = u._tr_tally(e3, 0, e3.window[e3.strstart]), e3.lookahead--, e3.strstart++, r3 && (N(e3, false), 0 === e3.strm.avail_out)) return A;
              }
              return e3.insert = 0, t3 === f ? (N(e3, true), 0 === e3.strm.avail_out ? O : B) : e3.last_lit && (N(e3, false), 0 === e3.strm.avail_out) ? A : I;
            })(n2, t2) : 3 === n2.strategy ? (function(e3, t3) {
              for (var r3, n3, i3, s3, a3 = e3.window; ; ) {
                if (e3.lookahead <= S) {
                  if (j(e3), e3.lookahead <= S && t3 === l) return A;
                  if (0 === e3.lookahead) break;
                }
                if (e3.match_length = 0, e3.lookahead >= x && 0 < e3.strstart && (n3 = a3[i3 = e3.strstart - 1]) === a3[++i3] && n3 === a3[++i3] && n3 === a3[++i3]) {
                  s3 = e3.strstart + S;
                  do {
                  } while (n3 === a3[++i3] && n3 === a3[++i3] && n3 === a3[++i3] && n3 === a3[++i3] && n3 === a3[++i3] && n3 === a3[++i3] && n3 === a3[++i3] && n3 === a3[++i3] && i3 < s3);
                  e3.match_length = S - (s3 - i3), e3.match_length > e3.lookahead && (e3.match_length = e3.lookahead);
                }
                if (e3.match_length >= x ? (r3 = u._tr_tally(e3, 1, e3.match_length - x), e3.lookahead -= e3.match_length, e3.strstart += e3.match_length, e3.match_length = 0) : (r3 = u._tr_tally(e3, 0, e3.window[e3.strstart]), e3.lookahead--, e3.strstart++), r3 && (N(e3, false), 0 === e3.strm.avail_out)) return A;
              }
              return e3.insert = 0, t3 === f ? (N(e3, true), 0 === e3.strm.avail_out ? O : B) : e3.last_lit && (N(e3, false), 0 === e3.strm.avail_out) ? A : I;
            })(n2, t2) : h[n2.level].func(n2, t2);
            if (o2 !== O && o2 !== B || (n2.status = 666), o2 === A || o2 === O) return 0 === e2.avail_out && (n2.last_flush = -1), m;
            if (o2 === I && (1 === t2 ? u._tr_align(n2) : 5 !== t2 && (u._tr_stored_block(n2, 0, 0, false), 3 === t2 && (D(n2.head), 0 === n2.lookahead && (n2.strstart = 0, n2.block_start = 0, n2.insert = 0))), F(e2), 0 === e2.avail_out)) return n2.last_flush = -1, m;
          }
          return t2 !== f ? m : n2.wrap <= 0 ? 1 : (2 === n2.wrap ? (U(n2, 255 & e2.adler), U(n2, e2.adler >> 8 & 255), U(n2, e2.adler >> 16 & 255), U(n2, e2.adler >> 24 & 255), U(n2, 255 & e2.total_in), U(n2, e2.total_in >> 8 & 255), U(n2, e2.total_in >> 16 & 255), U(n2, e2.total_in >> 24 & 255)) : (P(n2, e2.adler >>> 16), P(n2, 65535 & e2.adler)), F(e2), 0 < n2.wrap && (n2.wrap = -n2.wrap), 0 !== n2.pending ? m : 1);
        }, r.deflateEnd = function(e2) {
          var t2;
          return e2 && e2.state ? (t2 = e2.state.status) !== C && 69 !== t2 && 73 !== t2 && 91 !== t2 && 103 !== t2 && t2 !== E && 666 !== t2 ? R(e2, _) : (e2.state = null, t2 === E ? R(e2, -3) : m) : _;
        }, r.deflateSetDictionary = function(e2, t2) {
          var r2, n2, i2, s2, a2, o2, h2, u2, l2 = t2.length;
          if (!e2 || !e2.state) return _;
          if (2 === (s2 = (r2 = e2.state).wrap) || 1 === s2 && r2.status !== C || r2.lookahead) return _;
          for (1 === s2 && (e2.adler = d(e2.adler, t2, l2, 0)), r2.wrap = 0, l2 >= r2.w_size && (0 === s2 && (D(r2.head), r2.strstart = 0, r2.block_start = 0, r2.insert = 0), u2 = new c.Buf8(r2.w_size), c.arraySet(u2, t2, l2 - r2.w_size, r2.w_size, 0), t2 = u2, l2 = r2.w_size), a2 = e2.avail_in, o2 = e2.next_in, h2 = e2.input, e2.avail_in = l2, e2.next_in = 0, e2.input = t2, j(r2); r2.lookahead >= x; ) {
            for (n2 = r2.strstart, i2 = r2.lookahead - (x - 1); r2.ins_h = (r2.ins_h << r2.hash_shift ^ r2.window[n2 + x - 1]) & r2.hash_mask, r2.prev[n2 & r2.w_mask] = r2.head[r2.ins_h], r2.head[r2.ins_h] = n2, n2++, --i2; ) ;
            r2.strstart = n2, r2.lookahead = x - 1, j(r2);
          }
          return r2.strstart += r2.lookahead, r2.block_start = r2.strstart, r2.insert = r2.lookahead, r2.lookahead = 0, r2.match_length = r2.prev_length = x - 1, r2.match_available = 0, e2.next_in = o2, e2.input = h2, e2.avail_in = a2, r2.wrap = s2, m;
        }, r.deflateInfo = "pako deflate (from Nodeca project)";
      }, { "../utils/common": 41, "./adler32": 43, "./crc32": 45, "./messages": 51, "./trees": 52 }], 47: [function(e, t, r) {
        "use strict";
        t.exports = function() {
          this.text = 0, this.time = 0, this.xflags = 0, this.os = 0, this.extra = null, this.extra_len = 0, this.name = "", this.comment = "", this.hcrc = 0, this.done = false;
        };
      }, {}], 48: [function(e, t, r) {
        "use strict";
        t.exports = function(e2, t2) {
          var r2, n, i, s, a, o, h, u, l, f, c, d, p, m, _, g, b, v, y, w, k, x, S, z, C;
          r2 = e2.state, n = e2.next_in, z = e2.input, i = n + (e2.avail_in - 5), s = e2.next_out, C = e2.output, a = s - (t2 - e2.avail_out), o = s + (e2.avail_out - 257), h = r2.dmax, u = r2.wsize, l = r2.whave, f = r2.wnext, c = r2.window, d = r2.hold, p = r2.bits, m = r2.lencode, _ = r2.distcode, g = (1 << r2.lenbits) - 1, b = (1 << r2.distbits) - 1;
          e: do {
            p < 15 && (d += z[n++] << p, p += 8, d += z[n++] << p, p += 8), v = m[d & g];
            t: for (; ; ) {
              if (d >>>= y = v >>> 24, p -= y, 0 === (y = v >>> 16 & 255)) C[s++] = 65535 & v;
              else {
                if (!(16 & y)) {
                  if (0 == (64 & y)) {
                    v = m[(65535 & v) + (d & (1 << y) - 1)];
                    continue t;
                  }
                  if (32 & y) {
                    r2.mode = 12;
                    break e;
                  }
                  e2.msg = "invalid literal/length code", r2.mode = 30;
                  break e;
                }
                w = 65535 & v, (y &= 15) && (p < y && (d += z[n++] << p, p += 8), w += d & (1 << y) - 1, d >>>= y, p -= y), p < 15 && (d += z[n++] << p, p += 8, d += z[n++] << p, p += 8), v = _[d & b];
                r: for (; ; ) {
                  if (d >>>= y = v >>> 24, p -= y, !(16 & (y = v >>> 16 & 255))) {
                    if (0 == (64 & y)) {
                      v = _[(65535 & v) + (d & (1 << y) - 1)];
                      continue r;
                    }
                    e2.msg = "invalid distance code", r2.mode = 30;
                    break e;
                  }
                  if (k = 65535 & v, p < (y &= 15) && (d += z[n++] << p, (p += 8) < y && (d += z[n++] << p, p += 8)), h < (k += d & (1 << y) - 1)) {
                    e2.msg = "invalid distance too far back", r2.mode = 30;
                    break e;
                  }
                  if (d >>>= y, p -= y, (y = s - a) < k) {
                    if (l < (y = k - y) && r2.sane) {
                      e2.msg = "invalid distance too far back", r2.mode = 30;
                      break e;
                    }
                    if (S = c, (x = 0) === f) {
                      if (x += u - y, y < w) {
                        for (w -= y; C[s++] = c[x++], --y; ) ;
                        x = s - k, S = C;
                      }
                    } else if (f < y) {
                      if (x += u + f - y, (y -= f) < w) {
                        for (w -= y; C[s++] = c[x++], --y; ) ;
                        if (x = 0, f < w) {
                          for (w -= y = f; C[s++] = c[x++], --y; ) ;
                          x = s - k, S = C;
                        }
                      }
                    } else if (x += f - y, y < w) {
                      for (w -= y; C[s++] = c[x++], --y; ) ;
                      x = s - k, S = C;
                    }
                    for (; 2 < w; ) C[s++] = S[x++], C[s++] = S[x++], C[s++] = S[x++], w -= 3;
                    w && (C[s++] = S[x++], 1 < w && (C[s++] = S[x++]));
                  } else {
                    for (x = s - k; C[s++] = C[x++], C[s++] = C[x++], C[s++] = C[x++], 2 < (w -= 3); ) ;
                    w && (C[s++] = C[x++], 1 < w && (C[s++] = C[x++]));
                  }
                  break;
                }
              }
              break;
            }
          } while (n < i && s < o);
          n -= w = p >> 3, d &= (1 << (p -= w << 3)) - 1, e2.next_in = n, e2.next_out = s, e2.avail_in = n < i ? i - n + 5 : 5 - (n - i), e2.avail_out = s < o ? o - s + 257 : 257 - (s - o), r2.hold = d, r2.bits = p;
        };
      }, {}], 49: [function(e, t, r) {
        "use strict";
        var I = e("../utils/common"), O = e("./adler32"), B = e("./crc32"), R = e("./inffast"), T = e("./inftrees"), D = 1, F = 2, N = 0, U = -2, P = 1, n = 852, i = 592;
        function L(e2) {
          return (e2 >>> 24 & 255) + (e2 >>> 8 & 65280) + ((65280 & e2) << 8) + ((255 & e2) << 24);
        }
        function s() {
          this.mode = 0, this.last = false, this.wrap = 0, this.havedict = false, this.flags = 0, this.dmax = 0, this.check = 0, this.total = 0, this.head = null, this.wbits = 0, this.wsize = 0, this.whave = 0, this.wnext = 0, this.window = null, this.hold = 0, this.bits = 0, this.length = 0, this.offset = 0, this.extra = 0, this.lencode = null, this.distcode = null, this.lenbits = 0, this.distbits = 0, this.ncode = 0, this.nlen = 0, this.ndist = 0, this.have = 0, this.next = null, this.lens = new I.Buf16(320), this.work = new I.Buf16(288), this.lendyn = null, this.distdyn = null, this.sane = 0, this.back = 0, this.was = 0;
        }
        function a(e2) {
          var t2;
          return e2 && e2.state ? (t2 = e2.state, e2.total_in = e2.total_out = t2.total = 0, e2.msg = "", t2.wrap && (e2.adler = 1 & t2.wrap), t2.mode = P, t2.last = 0, t2.havedict = 0, t2.dmax = 32768, t2.head = null, t2.hold = 0, t2.bits = 0, t2.lencode = t2.lendyn = new I.Buf32(n), t2.distcode = t2.distdyn = new I.Buf32(i), t2.sane = 1, t2.back = -1, N) : U;
        }
        function o(e2) {
          var t2;
          return e2 && e2.state ? ((t2 = e2.state).wsize = 0, t2.whave = 0, t2.wnext = 0, a(e2)) : U;
        }
        function h(e2, t2) {
          var r2, n2;
          return e2 && e2.state ? (n2 = e2.state, t2 < 0 ? (r2 = 0, t2 = -t2) : (r2 = 1 + (t2 >> 4), t2 < 48 && (t2 &= 15)), t2 && (t2 < 8 || 15 < t2) ? U : (null !== n2.window && n2.wbits !== t2 && (n2.window = null), n2.wrap = r2, n2.wbits = t2, o(e2))) : U;
        }
        function u(e2, t2) {
          var r2, n2;
          return e2 ? (n2 = new s(), (e2.state = n2).window = null, (r2 = h(e2, t2)) !== N && (e2.state = null), r2) : U;
        }
        var l, f, c = true;
        function j(e2) {
          if (c) {
            var t2;
            for (l = new I.Buf32(512), f = new I.Buf32(32), t2 = 0; t2 < 144; ) e2.lens[t2++] = 8;
            for (; t2 < 256; ) e2.lens[t2++] = 9;
            for (; t2 < 280; ) e2.lens[t2++] = 7;
            for (; t2 < 288; ) e2.lens[t2++] = 8;
            for (T(D, e2.lens, 0, 288, l, 0, e2.work, { bits: 9 }), t2 = 0; t2 < 32; ) e2.lens[t2++] = 5;
            T(F, e2.lens, 0, 32, f, 0, e2.work, { bits: 5 }), c = false;
          }
          e2.lencode = l, e2.lenbits = 9, e2.distcode = f, e2.distbits = 5;
        }
        function Z(e2, t2, r2, n2) {
          var i2, s2 = e2.state;
          return null === s2.window && (s2.wsize = 1 << s2.wbits, s2.wnext = 0, s2.whave = 0, s2.window = new I.Buf8(s2.wsize)), n2 >= s2.wsize ? (I.arraySet(s2.window, t2, r2 - s2.wsize, s2.wsize, 0), s2.wnext = 0, s2.whave = s2.wsize) : (n2 < (i2 = s2.wsize - s2.wnext) && (i2 = n2), I.arraySet(s2.window, t2, r2 - n2, i2, s2.wnext), (n2 -= i2) ? (I.arraySet(s2.window, t2, r2 - n2, n2, 0), s2.wnext = n2, s2.whave = s2.wsize) : (s2.wnext += i2, s2.wnext === s2.wsize && (s2.wnext = 0), s2.whave < s2.wsize && (s2.whave += i2))), 0;
        }
        r.inflateReset = o, r.inflateReset2 = h, r.inflateResetKeep = a, r.inflateInit = function(e2) {
          return u(e2, 15);
        }, r.inflateInit2 = u, r.inflate = function(e2, t2) {
          var r2, n2, i2, s2, a2, o2, h2, u2, l2, f2, c2, d, p, m, _, g, b, v, y, w, k, x, S, z, C = 0, E = new I.Buf8(4), A = [16, 17, 18, 0, 8, 7, 9, 6, 10, 5, 11, 4, 12, 3, 13, 2, 14, 1, 15];
          if (!e2 || !e2.state || !e2.output || !e2.input && 0 !== e2.avail_in) return U;
          12 === (r2 = e2.state).mode && (r2.mode = 13), a2 = e2.next_out, i2 = e2.output, h2 = e2.avail_out, s2 = e2.next_in, n2 = e2.input, o2 = e2.avail_in, u2 = r2.hold, l2 = r2.bits, f2 = o2, c2 = h2, x = N;
          e: for (; ; ) switch (r2.mode) {
            case P:
              if (0 === r2.wrap) {
                r2.mode = 13;
                break;
              }
              for (; l2 < 16; ) {
                if (0 === o2) break e;
                o2--, u2 += n2[s2++] << l2, l2 += 8;
              }
              if (2 & r2.wrap && 35615 === u2) {
                E[r2.check = 0] = 255 & u2, E[1] = u2 >>> 8 & 255, r2.check = B(r2.check, E, 2, 0), l2 = u2 = 0, r2.mode = 2;
                break;
              }
              if (r2.flags = 0, r2.head && (r2.head.done = false), !(1 & r2.wrap) || (((255 & u2) << 8) + (u2 >> 8)) % 31) {
                e2.msg = "incorrect header check", r2.mode = 30;
                break;
              }
              if (8 != (15 & u2)) {
                e2.msg = "unknown compression method", r2.mode = 30;
                break;
              }
              if (l2 -= 4, k = 8 + (15 & (u2 >>>= 4)), 0 === r2.wbits) r2.wbits = k;
              else if (k > r2.wbits) {
                e2.msg = "invalid window size", r2.mode = 30;
                break;
              }
              r2.dmax = 1 << k, e2.adler = r2.check = 1, r2.mode = 512 & u2 ? 10 : 12, l2 = u2 = 0;
              break;
            case 2:
              for (; l2 < 16; ) {
                if (0 === o2) break e;
                o2--, u2 += n2[s2++] << l2, l2 += 8;
              }
              if (r2.flags = u2, 8 != (255 & r2.flags)) {
                e2.msg = "unknown compression method", r2.mode = 30;
                break;
              }
              if (57344 & r2.flags) {
                e2.msg = "unknown header flags set", r2.mode = 30;
                break;
              }
              r2.head && (r2.head.text = u2 >> 8 & 1), 512 & r2.flags && (E[0] = 255 & u2, E[1] = u2 >>> 8 & 255, r2.check = B(r2.check, E, 2, 0)), l2 = u2 = 0, r2.mode = 3;
            case 3:
              for (; l2 < 32; ) {
                if (0 === o2) break e;
                o2--, u2 += n2[s2++] << l2, l2 += 8;
              }
              r2.head && (r2.head.time = u2), 512 & r2.flags && (E[0] = 255 & u2, E[1] = u2 >>> 8 & 255, E[2] = u2 >>> 16 & 255, E[3] = u2 >>> 24 & 255, r2.check = B(r2.check, E, 4, 0)), l2 = u2 = 0, r2.mode = 4;
            case 4:
              for (; l2 < 16; ) {
                if (0 === o2) break e;
                o2--, u2 += n2[s2++] << l2, l2 += 8;
              }
              r2.head && (r2.head.xflags = 255 & u2, r2.head.os = u2 >> 8), 512 & r2.flags && (E[0] = 255 & u2, E[1] = u2 >>> 8 & 255, r2.check = B(r2.check, E, 2, 0)), l2 = u2 = 0, r2.mode = 5;
            case 5:
              if (1024 & r2.flags) {
                for (; l2 < 16; ) {
                  if (0 === o2) break e;
                  o2--, u2 += n2[s2++] << l2, l2 += 8;
                }
                r2.length = u2, r2.head && (r2.head.extra_len = u2), 512 & r2.flags && (E[0] = 255 & u2, E[1] = u2 >>> 8 & 255, r2.check = B(r2.check, E, 2, 0)), l2 = u2 = 0;
              } else r2.head && (r2.head.extra = null);
              r2.mode = 6;
            case 6:
              if (1024 & r2.flags && (o2 < (d = r2.length) && (d = o2), d && (r2.head && (k = r2.head.extra_len - r2.length, r2.head.extra || (r2.head.extra = new Array(r2.head.extra_len)), I.arraySet(r2.head.extra, n2, s2, d, k)), 512 & r2.flags && (r2.check = B(r2.check, n2, d, s2)), o2 -= d, s2 += d, r2.length -= d), r2.length)) break e;
              r2.length = 0, r2.mode = 7;
            case 7:
              if (2048 & r2.flags) {
                if (0 === o2) break e;
                for (d = 0; k = n2[s2 + d++], r2.head && k && r2.length < 65536 && (r2.head.name += String.fromCharCode(k)), k && d < o2; ) ;
                if (512 & r2.flags && (r2.check = B(r2.check, n2, d, s2)), o2 -= d, s2 += d, k) break e;
              } else r2.head && (r2.head.name = null);
              r2.length = 0, r2.mode = 8;
            case 8:
              if (4096 & r2.flags) {
                if (0 === o2) break e;
                for (d = 0; k = n2[s2 + d++], r2.head && k && r2.length < 65536 && (r2.head.comment += String.fromCharCode(k)), k && d < o2; ) ;
                if (512 & r2.flags && (r2.check = B(r2.check, n2, d, s2)), o2 -= d, s2 += d, k) break e;
              } else r2.head && (r2.head.comment = null);
              r2.mode = 9;
            case 9:
              if (512 & r2.flags) {
                for (; l2 < 16; ) {
                  if (0 === o2) break e;
                  o2--, u2 += n2[s2++] << l2, l2 += 8;
                }
                if (u2 !== (65535 & r2.check)) {
                  e2.msg = "header crc mismatch", r2.mode = 30;
                  break;
                }
                l2 = u2 = 0;
              }
              r2.head && (r2.head.hcrc = r2.flags >> 9 & 1, r2.head.done = true), e2.adler = r2.check = 0, r2.mode = 12;
              break;
            case 10:
              for (; l2 < 32; ) {
                if (0 === o2) break e;
                o2--, u2 += n2[s2++] << l2, l2 += 8;
              }
              e2.adler = r2.check = L(u2), l2 = u2 = 0, r2.mode = 11;
            case 11:
              if (0 === r2.havedict) return e2.next_out = a2, e2.avail_out = h2, e2.next_in = s2, e2.avail_in = o2, r2.hold = u2, r2.bits = l2, 2;
              e2.adler = r2.check = 1, r2.mode = 12;
            case 12:
              if (5 === t2 || 6 === t2) break e;
            case 13:
              if (r2.last) {
                u2 >>>= 7 & l2, l2 -= 7 & l2, r2.mode = 27;
                break;
              }
              for (; l2 < 3; ) {
                if (0 === o2) break e;
                o2--, u2 += n2[s2++] << l2, l2 += 8;
              }
              switch (r2.last = 1 & u2, l2 -= 1, 3 & (u2 >>>= 1)) {
                case 0:
                  r2.mode = 14;
                  break;
                case 1:
                  if (j(r2), r2.mode = 20, 6 !== t2) break;
                  u2 >>>= 2, l2 -= 2;
                  break e;
                case 2:
                  r2.mode = 17;
                  break;
                case 3:
                  e2.msg = "invalid block type", r2.mode = 30;
              }
              u2 >>>= 2, l2 -= 2;
              break;
            case 14:
              for (u2 >>>= 7 & l2, l2 -= 7 & l2; l2 < 32; ) {
                if (0 === o2) break e;
                o2--, u2 += n2[s2++] << l2, l2 += 8;
              }
              if ((65535 & u2) != (u2 >>> 16 ^ 65535)) {
                e2.msg = "invalid stored block lengths", r2.mode = 30;
                break;
              }
              if (r2.length = 65535 & u2, l2 = u2 = 0, r2.mode = 15, 6 === t2) break e;
            case 15:
              r2.mode = 16;
            case 16:
              if (d = r2.length) {
                if (o2 < d && (d = o2), h2 < d && (d = h2), 0 === d) break e;
                I.arraySet(i2, n2, s2, d, a2), o2 -= d, s2 += d, h2 -= d, a2 += d, r2.length -= d;
                break;
              }
              r2.mode = 12;
              break;
            case 17:
              for (; l2 < 14; ) {
                if (0 === o2) break e;
                o2--, u2 += n2[s2++] << l2, l2 += 8;
              }
              if (r2.nlen = 257 + (31 & u2), u2 >>>= 5, l2 -= 5, r2.ndist = 1 + (31 & u2), u2 >>>= 5, l2 -= 5, r2.ncode = 4 + (15 & u2), u2 >>>= 4, l2 -= 4, 286 < r2.nlen || 30 < r2.ndist) {
                e2.msg = "too many length or distance symbols", r2.mode = 30;
                break;
              }
              r2.have = 0, r2.mode = 18;
            case 18:
              for (; r2.have < r2.ncode; ) {
                for (; l2 < 3; ) {
                  if (0 === o2) break e;
                  o2--, u2 += n2[s2++] << l2, l2 += 8;
                }
                r2.lens[A[r2.have++]] = 7 & u2, u2 >>>= 3, l2 -= 3;
              }
              for (; r2.have < 19; ) r2.lens[A[r2.have++]] = 0;
              if (r2.lencode = r2.lendyn, r2.lenbits = 7, S = { bits: r2.lenbits }, x = T(0, r2.lens, 0, 19, r2.lencode, 0, r2.work, S), r2.lenbits = S.bits, x) {
                e2.msg = "invalid code lengths set", r2.mode = 30;
                break;
              }
              r2.have = 0, r2.mode = 19;
            case 19:
              for (; r2.have < r2.nlen + r2.ndist; ) {
                for (; g = (C = r2.lencode[u2 & (1 << r2.lenbits) - 1]) >>> 16 & 255, b = 65535 & C, !((_ = C >>> 24) <= l2); ) {
                  if (0 === o2) break e;
                  o2--, u2 += n2[s2++] << l2, l2 += 8;
                }
                if (b < 16) u2 >>>= _, l2 -= _, r2.lens[r2.have++] = b;
                else {
                  if (16 === b) {
                    for (z = _ + 2; l2 < z; ) {
                      if (0 === o2) break e;
                      o2--, u2 += n2[s2++] << l2, l2 += 8;
                    }
                    if (u2 >>>= _, l2 -= _, 0 === r2.have) {
                      e2.msg = "invalid bit length repeat", r2.mode = 30;
                      break;
                    }
                    k = r2.lens[r2.have - 1], d = 3 + (3 & u2), u2 >>>= 2, l2 -= 2;
                  } else if (17 === b) {
                    for (z = _ + 3; l2 < z; ) {
                      if (0 === o2) break e;
                      o2--, u2 += n2[s2++] << l2, l2 += 8;
                    }
                    l2 -= _, k = 0, d = 3 + (7 & (u2 >>>= _)), u2 >>>= 3, l2 -= 3;
                  } else {
                    for (z = _ + 7; l2 < z; ) {
                      if (0 === o2) break e;
                      o2--, u2 += n2[s2++] << l2, l2 += 8;
                    }
                    l2 -= _, k = 0, d = 11 + (127 & (u2 >>>= _)), u2 >>>= 7, l2 -= 7;
                  }
                  if (r2.have + d > r2.nlen + r2.ndist) {
                    e2.msg = "invalid bit length repeat", r2.mode = 30;
                    break;
                  }
                  for (; d--; ) r2.lens[r2.have++] = k;
                }
              }
              if (30 === r2.mode) break;
              if (0 === r2.lens[256]) {
                e2.msg = "invalid code -- missing end-of-block", r2.mode = 30;
                break;
              }
              if (r2.lenbits = 9, S = { bits: r2.lenbits }, x = T(D, r2.lens, 0, r2.nlen, r2.lencode, 0, r2.work, S), r2.lenbits = S.bits, x) {
                e2.msg = "invalid literal/lengths set", r2.mode = 30;
                break;
              }
              if (r2.distbits = 6, r2.distcode = r2.distdyn, S = { bits: r2.distbits }, x = T(F, r2.lens, r2.nlen, r2.ndist, r2.distcode, 0, r2.work, S), r2.distbits = S.bits, x) {
                e2.msg = "invalid distances set", r2.mode = 30;
                break;
              }
              if (r2.mode = 20, 6 === t2) break e;
            case 20:
              r2.mode = 21;
            case 21:
              if (6 <= o2 && 258 <= h2) {
                e2.next_out = a2, e2.avail_out = h2, e2.next_in = s2, e2.avail_in = o2, r2.hold = u2, r2.bits = l2, R(e2, c2), a2 = e2.next_out, i2 = e2.output, h2 = e2.avail_out, s2 = e2.next_in, n2 = e2.input, o2 = e2.avail_in, u2 = r2.hold, l2 = r2.bits, 12 === r2.mode && (r2.back = -1);
                break;
              }
              for (r2.back = 0; g = (C = r2.lencode[u2 & (1 << r2.lenbits) - 1]) >>> 16 & 255, b = 65535 & C, !((_ = C >>> 24) <= l2); ) {
                if (0 === o2) break e;
                o2--, u2 += n2[s2++] << l2, l2 += 8;
              }
              if (g && 0 == (240 & g)) {
                for (v = _, y = g, w = b; g = (C = r2.lencode[w + ((u2 & (1 << v + y) - 1) >> v)]) >>> 16 & 255, b = 65535 & C, !(v + (_ = C >>> 24) <= l2); ) {
                  if (0 === o2) break e;
                  o2--, u2 += n2[s2++] << l2, l2 += 8;
                }
                u2 >>>= v, l2 -= v, r2.back += v;
              }
              if (u2 >>>= _, l2 -= _, r2.back += _, r2.length = b, 0 === g) {
                r2.mode = 26;
                break;
              }
              if (32 & g) {
                r2.back = -1, r2.mode = 12;
                break;
              }
              if (64 & g) {
                e2.msg = "invalid literal/length code", r2.mode = 30;
                break;
              }
              r2.extra = 15 & g, r2.mode = 22;
            case 22:
              if (r2.extra) {
                for (z = r2.extra; l2 < z; ) {
                  if (0 === o2) break e;
                  o2--, u2 += n2[s2++] << l2, l2 += 8;
                }
                r2.length += u2 & (1 << r2.extra) - 1, u2 >>>= r2.extra, l2 -= r2.extra, r2.back += r2.extra;
              }
              r2.was = r2.length, r2.mode = 23;
            case 23:
              for (; g = (C = r2.distcode[u2 & (1 << r2.distbits) - 1]) >>> 16 & 255, b = 65535 & C, !((_ = C >>> 24) <= l2); ) {
                if (0 === o2) break e;
                o2--, u2 += n2[s2++] << l2, l2 += 8;
              }
              if (0 == (240 & g)) {
                for (v = _, y = g, w = b; g = (C = r2.distcode[w + ((u2 & (1 << v + y) - 1) >> v)]) >>> 16 & 255, b = 65535 & C, !(v + (_ = C >>> 24) <= l2); ) {
                  if (0 === o2) break e;
                  o2--, u2 += n2[s2++] << l2, l2 += 8;
                }
                u2 >>>= v, l2 -= v, r2.back += v;
              }
              if (u2 >>>= _, l2 -= _, r2.back += _, 64 & g) {
                e2.msg = "invalid distance code", r2.mode = 30;
                break;
              }
              r2.offset = b, r2.extra = 15 & g, r2.mode = 24;
            case 24:
              if (r2.extra) {
                for (z = r2.extra; l2 < z; ) {
                  if (0 === o2) break e;
                  o2--, u2 += n2[s2++] << l2, l2 += 8;
                }
                r2.offset += u2 & (1 << r2.extra) - 1, u2 >>>= r2.extra, l2 -= r2.extra, r2.back += r2.extra;
              }
              if (r2.offset > r2.dmax) {
                e2.msg = "invalid distance too far back", r2.mode = 30;
                break;
              }
              r2.mode = 25;
            case 25:
              if (0 === h2) break e;
              if (d = c2 - h2, r2.offset > d) {
                if ((d = r2.offset - d) > r2.whave && r2.sane) {
                  e2.msg = "invalid distance too far back", r2.mode = 30;
                  break;
                }
                p = d > r2.wnext ? (d -= r2.wnext, r2.wsize - d) : r2.wnext - d, d > r2.length && (d = r2.length), m = r2.window;
              } else m = i2, p = a2 - r2.offset, d = r2.length;
              for (h2 < d && (d = h2), h2 -= d, r2.length -= d; i2[a2++] = m[p++], --d; ) ;
              0 === r2.length && (r2.mode = 21);
              break;
            case 26:
              if (0 === h2) break e;
              i2[a2++] = r2.length, h2--, r2.mode = 21;
              break;
            case 27:
              if (r2.wrap) {
                for (; l2 < 32; ) {
                  if (0 === o2) break e;
                  o2--, u2 |= n2[s2++] << l2, l2 += 8;
                }
                if (c2 -= h2, e2.total_out += c2, r2.total += c2, c2 && (e2.adler = r2.check = r2.flags ? B(r2.check, i2, c2, a2 - c2) : O(r2.check, i2, c2, a2 - c2)), c2 = h2, (r2.flags ? u2 : L(u2)) !== r2.check) {
                  e2.msg = "incorrect data check", r2.mode = 30;
                  break;
                }
                l2 = u2 = 0;
              }
              r2.mode = 28;
            case 28:
              if (r2.wrap && r2.flags) {
                for (; l2 < 32; ) {
                  if (0 === o2) break e;
                  o2--, u2 += n2[s2++] << l2, l2 += 8;
                }
                if (u2 !== (4294967295 & r2.total)) {
                  e2.msg = "incorrect length check", r2.mode = 30;
                  break;
                }
                l2 = u2 = 0;
              }
              r2.mode = 29;
            case 29:
              x = 1;
              break e;
            case 30:
              x = -3;
              break e;
            case 31:
              return -4;
            case 32:
            default:
              return U;
          }
          return e2.next_out = a2, e2.avail_out = h2, e2.next_in = s2, e2.avail_in = o2, r2.hold = u2, r2.bits = l2, (r2.wsize || c2 !== e2.avail_out && r2.mode < 30 && (r2.mode < 27 || 4 !== t2)) && Z(e2, e2.output, e2.next_out, c2 - e2.avail_out) ? (r2.mode = 31, -4) : (f2 -= e2.avail_in, c2 -= e2.avail_out, e2.total_in += f2, e2.total_out += c2, r2.total += c2, r2.wrap && c2 && (e2.adler = r2.check = r2.flags ? B(r2.check, i2, c2, e2.next_out - c2) : O(r2.check, i2, c2, e2.next_out - c2)), e2.data_type = r2.bits + (r2.last ? 64 : 0) + (12 === r2.mode ? 128 : 0) + (20 === r2.mode || 15 === r2.mode ? 256 : 0), (0 == f2 && 0 === c2 || 4 === t2) && x === N && (x = -5), x);
        }, r.inflateEnd = function(e2) {
          if (!e2 || !e2.state) return U;
          var t2 = e2.state;
          return t2.window && (t2.window = null), e2.state = null, N;
        }, r.inflateGetHeader = function(e2, t2) {
          var r2;
          return e2 && e2.state ? 0 == (2 & (r2 = e2.state).wrap) ? U : ((r2.head = t2).done = false, N) : U;
        }, r.inflateSetDictionary = function(e2, t2) {
          var r2, n2 = t2.length;
          return e2 && e2.state ? 0 !== (r2 = e2.state).wrap && 11 !== r2.mode ? U : 11 === r2.mode && O(1, t2, n2, 0) !== r2.check ? -3 : Z(e2, t2, n2, n2) ? (r2.mode = 31, -4) : (r2.havedict = 1, N) : U;
        }, r.inflateInfo = "pako inflate (from Nodeca project)";
      }, { "../utils/common": 41, "./adler32": 43, "./crc32": 45, "./inffast": 48, "./inftrees": 50 }], 50: [function(e, t, r) {
        "use strict";
        var D = e("../utils/common"), F = [3, 4, 5, 6, 7, 8, 9, 10, 11, 13, 15, 17, 19, 23, 27, 31, 35, 43, 51, 59, 67, 83, 99, 115, 131, 163, 195, 227, 258, 0, 0], N = [16, 16, 16, 16, 16, 16, 16, 16, 17, 17, 17, 17, 18, 18, 18, 18, 19, 19, 19, 19, 20, 20, 20, 20, 21, 21, 21, 21, 16, 72, 78], U = [1, 2, 3, 4, 5, 7, 9, 13, 17, 25, 33, 49, 65, 97, 129, 193, 257, 385, 513, 769, 1025, 1537, 2049, 3073, 4097, 6145, 8193, 12289, 16385, 24577, 0, 0], P = [16, 16, 16, 16, 17, 17, 18, 18, 19, 19, 20, 20, 21, 21, 22, 22, 23, 23, 24, 24, 25, 25, 26, 26, 27, 27, 28, 28, 29, 29, 64, 64];
        t.exports = function(e2, t2, r2, n, i, s, a, o) {
          var h, u, l, f, c, d, p, m, _, g = o.bits, b = 0, v = 0, y = 0, w = 0, k = 0, x = 0, S = 0, z = 0, C = 0, E = 0, A = null, I = 0, O = new D.Buf16(16), B = new D.Buf16(16), R = null, T = 0;
          for (b = 0; b <= 15; b++) O[b] = 0;
          for (v = 0; v < n; v++) O[t2[r2 + v]]++;
          for (k = g, w = 15; 1 <= w && 0 === O[w]; w--) ;
          if (w < k && (k = w), 0 === w) return i[s++] = 20971520, i[s++] = 20971520, o.bits = 1, 0;
          for (y = 1; y < w && 0 === O[y]; y++) ;
          for (k < y && (k = y), b = z = 1; b <= 15; b++) if (z <<= 1, (z -= O[b]) < 0) return -1;
          if (0 < z && (0 === e2 || 1 !== w)) return -1;
          for (B[1] = 0, b = 1; b < 15; b++) B[b + 1] = B[b] + O[b];
          for (v = 0; v < n; v++) 0 !== t2[r2 + v] && (a[B[t2[r2 + v]]++] = v);
          if (d = 0 === e2 ? (A = R = a, 19) : 1 === e2 ? (A = F, I -= 257, R = N, T -= 257, 256) : (A = U, R = P, -1), b = y, c = s, S = v = E = 0, l = -1, f = (C = 1 << (x = k)) - 1, 1 === e2 && 852 < C || 2 === e2 && 592 < C) return 1;
          for (; ; ) {
            for (p = b - S, _ = a[v] < d ? (m = 0, a[v]) : a[v] > d ? (m = R[T + a[v]], A[I + a[v]]) : (m = 96, 0), h = 1 << b - S, y = u = 1 << x; i[c + (E >> S) + (u -= h)] = p << 24 | m << 16 | _ | 0, 0 !== u; ) ;
            for (h = 1 << b - 1; E & h; ) h >>= 1;
            if (0 !== h ? (E &= h - 1, E += h) : E = 0, v++, 0 == --O[b]) {
              if (b === w) break;
              b = t2[r2 + a[v]];
            }
            if (k < b && (E & f) !== l) {
              for (0 === S && (S = k), c += y, z = 1 << (x = b - S); x + S < w && !((z -= O[x + S]) <= 0); ) x++, z <<= 1;
              if (C += 1 << x, 1 === e2 && 852 < C || 2 === e2 && 592 < C) return 1;
              i[l = E & f] = k << 24 | x << 16 | c - s | 0;
            }
          }
          return 0 !== E && (i[c + E] = b - S << 24 | 64 << 16 | 0), o.bits = k, 0;
        };
      }, { "../utils/common": 41 }], 51: [function(e, t, r) {
        "use strict";
        t.exports = { 2: "need dictionary", 1: "stream end", 0: "", "-1": "file error", "-2": "stream error", "-3": "data error", "-4": "insufficient memory", "-5": "buffer error", "-6": "incompatible version" };
      }, {}], 52: [function(e, t, r) {
        "use strict";
        var i = e("../utils/common"), o = 0, h = 1;
        function n(e2) {
          for (var t2 = e2.length; 0 <= --t2; ) e2[t2] = 0;
        }
        var s = 0, a = 29, u = 256, l = u + 1 + a, f = 30, c = 19, _ = 2 * l + 1, g = 15, d = 16, p = 7, m = 256, b = 16, v = 17, y = 18, w = [0, 0, 0, 0, 0, 0, 0, 0, 1, 1, 1, 1, 2, 2, 2, 2, 3, 3, 3, 3, 4, 4, 4, 4, 5, 5, 5, 5, 0], k = [0, 0, 0, 0, 1, 1, 2, 2, 3, 3, 4, 4, 5, 5, 6, 6, 7, 7, 8, 8, 9, 9, 10, 10, 11, 11, 12, 12, 13, 13], x = [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 2, 3, 7], S = [16, 17, 18, 0, 8, 7, 9, 6, 10, 5, 11, 4, 12, 3, 13, 2, 14, 1, 15], z = new Array(2 * (l + 2));
        n(z);
        var C = new Array(2 * f);
        n(C);
        var E = new Array(512);
        n(E);
        var A = new Array(256);
        n(A);
        var I = new Array(a);
        n(I);
        var O, B, R, T = new Array(f);
        function D(e2, t2, r2, n2, i2) {
          this.static_tree = e2, this.extra_bits = t2, this.extra_base = r2, this.elems = n2, this.max_length = i2, this.has_stree = e2 && e2.length;
        }
        function F(e2, t2) {
          this.dyn_tree = e2, this.max_code = 0, this.stat_desc = t2;
        }
        function N(e2) {
          return e2 < 256 ? E[e2] : E[256 + (e2 >>> 7)];
        }
        function U(e2, t2) {
          e2.pending_buf[e2.pending++] = 255 & t2, e2.pending_buf[e2.pending++] = t2 >>> 8 & 255;
        }
        function P(e2, t2, r2) {
          e2.bi_valid > d - r2 ? (e2.bi_buf |= t2 << e2.bi_valid & 65535, U(e2, e2.bi_buf), e2.bi_buf = t2 >> d - e2.bi_valid, e2.bi_valid += r2 - d) : (e2.bi_buf |= t2 << e2.bi_valid & 65535, e2.bi_valid += r2);
        }
        function L(e2, t2, r2) {
          P(e2, r2[2 * t2], r2[2 * t2 + 1]);
        }
        function j(e2, t2) {
          for (var r2 = 0; r2 |= 1 & e2, e2 >>>= 1, r2 <<= 1, 0 < --t2; ) ;
          return r2 >>> 1;
        }
        function Z(e2, t2, r2) {
          var n2, i2, s2 = new Array(g + 1), a2 = 0;
          for (n2 = 1; n2 <= g; n2++) s2[n2] = a2 = a2 + r2[n2 - 1] << 1;
          for (i2 = 0; i2 <= t2; i2++) {
            var o2 = e2[2 * i2 + 1];
            0 !== o2 && (e2[2 * i2] = j(s2[o2]++, o2));
          }
        }
        function W(e2) {
          var t2;
          for (t2 = 0; t2 < l; t2++) e2.dyn_ltree[2 * t2] = 0;
          for (t2 = 0; t2 < f; t2++) e2.dyn_dtree[2 * t2] = 0;
          for (t2 = 0; t2 < c; t2++) e2.bl_tree[2 * t2] = 0;
          e2.dyn_ltree[2 * m] = 1, e2.opt_len = e2.static_len = 0, e2.last_lit = e2.matches = 0;
        }
        function M(e2) {
          8 < e2.bi_valid ? U(e2, e2.bi_buf) : 0 < e2.bi_valid && (e2.pending_buf[e2.pending++] = e2.bi_buf), e2.bi_buf = 0, e2.bi_valid = 0;
        }
        function H(e2, t2, r2, n2) {
          var i2 = 2 * t2, s2 = 2 * r2;
          return e2[i2] < e2[s2] || e2[i2] === e2[s2] && n2[t2] <= n2[r2];
        }
        function G(e2, t2, r2) {
          for (var n2 = e2.heap[r2], i2 = r2 << 1; i2 <= e2.heap_len && (i2 < e2.heap_len && H(t2, e2.heap[i2 + 1], e2.heap[i2], e2.depth) && i2++, !H(t2, n2, e2.heap[i2], e2.depth)); ) e2.heap[r2] = e2.heap[i2], r2 = i2, i2 <<= 1;
          e2.heap[r2] = n2;
        }
        function K(e2, t2, r2) {
          var n2, i2, s2, a2, o2 = 0;
          if (0 !== e2.last_lit) for (; n2 = e2.pending_buf[e2.d_buf + 2 * o2] << 8 | e2.pending_buf[e2.d_buf + 2 * o2 + 1], i2 = e2.pending_buf[e2.l_buf + o2], o2++, 0 === n2 ? L(e2, i2, t2) : (L(e2, (s2 = A[i2]) + u + 1, t2), 0 !== (a2 = w[s2]) && P(e2, i2 -= I[s2], a2), L(e2, s2 = N(--n2), r2), 0 !== (a2 = k[s2]) && P(e2, n2 -= T[s2], a2)), o2 < e2.last_lit; ) ;
          L(e2, m, t2);
        }
        function Y(e2, t2) {
          var r2, n2, i2, s2 = t2.dyn_tree, a2 = t2.stat_desc.static_tree, o2 = t2.stat_desc.has_stree, h2 = t2.stat_desc.elems, u2 = -1;
          for (e2.heap_len = 0, e2.heap_max = _, r2 = 0; r2 < h2; r2++) 0 !== s2[2 * r2] ? (e2.heap[++e2.heap_len] = u2 = r2, e2.depth[r2] = 0) : s2[2 * r2 + 1] = 0;
          for (; e2.heap_len < 2; ) s2[2 * (i2 = e2.heap[++e2.heap_len] = u2 < 2 ? ++u2 : 0)] = 1, e2.depth[i2] = 0, e2.opt_len--, o2 && (e2.static_len -= a2[2 * i2 + 1]);
          for (t2.max_code = u2, r2 = e2.heap_len >> 1; 1 <= r2; r2--) G(e2, s2, r2);
          for (i2 = h2; r2 = e2.heap[1], e2.heap[1] = e2.heap[e2.heap_len--], G(e2, s2, 1), n2 = e2.heap[1], e2.heap[--e2.heap_max] = r2, e2.heap[--e2.heap_max] = n2, s2[2 * i2] = s2[2 * r2] + s2[2 * n2], e2.depth[i2] = (e2.depth[r2] >= e2.depth[n2] ? e2.depth[r2] : e2.depth[n2]) + 1, s2[2 * r2 + 1] = s2[2 * n2 + 1] = i2, e2.heap[1] = i2++, G(e2, s2, 1), 2 <= e2.heap_len; ) ;
          e2.heap[--e2.heap_max] = e2.heap[1], (function(e3, t3) {
            var r3, n3, i3, s3, a3, o3, h3 = t3.dyn_tree, u3 = t3.max_code, l2 = t3.stat_desc.static_tree, f2 = t3.stat_desc.has_stree, c2 = t3.stat_desc.extra_bits, d2 = t3.stat_desc.extra_base, p2 = t3.stat_desc.max_length, m2 = 0;
            for (s3 = 0; s3 <= g; s3++) e3.bl_count[s3] = 0;
            for (h3[2 * e3.heap[e3.heap_max] + 1] = 0, r3 = e3.heap_max + 1; r3 < _; r3++) p2 < (s3 = h3[2 * h3[2 * (n3 = e3.heap[r3]) + 1] + 1] + 1) && (s3 = p2, m2++), h3[2 * n3 + 1] = s3, u3 < n3 || (e3.bl_count[s3]++, a3 = 0, d2 <= n3 && (a3 = c2[n3 - d2]), o3 = h3[2 * n3], e3.opt_len += o3 * (s3 + a3), f2 && (e3.static_len += o3 * (l2[2 * n3 + 1] + a3)));
            if (0 !== m2) {
              do {
                for (s3 = p2 - 1; 0 === e3.bl_count[s3]; ) s3--;
                e3.bl_count[s3]--, e3.bl_count[s3 + 1] += 2, e3.bl_count[p2]--, m2 -= 2;
              } while (0 < m2);
              for (s3 = p2; 0 !== s3; s3--) for (n3 = e3.bl_count[s3]; 0 !== n3; ) u3 < (i3 = e3.heap[--r3]) || (h3[2 * i3 + 1] !== s3 && (e3.opt_len += (s3 - h3[2 * i3 + 1]) * h3[2 * i3], h3[2 * i3 + 1] = s3), n3--);
            }
          })(e2, t2), Z(s2, u2, e2.bl_count);
        }
        function X(e2, t2, r2) {
          var n2, i2, s2 = -1, a2 = t2[1], o2 = 0, h2 = 7, u2 = 4;
          for (0 === a2 && (h2 = 138, u2 = 3), t2[2 * (r2 + 1) + 1] = 65535, n2 = 0; n2 <= r2; n2++) i2 = a2, a2 = t2[2 * (n2 + 1) + 1], ++o2 < h2 && i2 === a2 || (o2 < u2 ? e2.bl_tree[2 * i2] += o2 : 0 !== i2 ? (i2 !== s2 && e2.bl_tree[2 * i2]++, e2.bl_tree[2 * b]++) : o2 <= 10 ? e2.bl_tree[2 * v]++ : e2.bl_tree[2 * y]++, s2 = i2, u2 = (o2 = 0) === a2 ? (h2 = 138, 3) : i2 === a2 ? (h2 = 6, 3) : (h2 = 7, 4));
        }
        function V(e2, t2, r2) {
          var n2, i2, s2 = -1, a2 = t2[1], o2 = 0, h2 = 7, u2 = 4;
          for (0 === a2 && (h2 = 138, u2 = 3), n2 = 0; n2 <= r2; n2++) if (i2 = a2, a2 = t2[2 * (n2 + 1) + 1], !(++o2 < h2 && i2 === a2)) {
            if (o2 < u2) for (; L(e2, i2, e2.bl_tree), 0 != --o2; ) ;
            else 0 !== i2 ? (i2 !== s2 && (L(e2, i2, e2.bl_tree), o2--), L(e2, b, e2.bl_tree), P(e2, o2 - 3, 2)) : o2 <= 10 ? (L(e2, v, e2.bl_tree), P(e2, o2 - 3, 3)) : (L(e2, y, e2.bl_tree), P(e2, o2 - 11, 7));
            s2 = i2, u2 = (o2 = 0) === a2 ? (h2 = 138, 3) : i2 === a2 ? (h2 = 6, 3) : (h2 = 7, 4);
          }
        }
        n(T);
        var q = false;
        function J(e2, t2, r2, n2) {
          P(e2, (s << 1) + (n2 ? 1 : 0), 3), (function(e3, t3, r3, n3) {
            M(e3), n3 && (U(e3, r3), U(e3, ~r3)), i.arraySet(e3.pending_buf, e3.window, t3, r3, e3.pending), e3.pending += r3;
          })(e2, t2, r2, true);
        }
        r._tr_init = function(e2) {
          q || ((function() {
            var e3, t2, r2, n2, i2, s2 = new Array(g + 1);
            for (n2 = r2 = 0; n2 < a - 1; n2++) for (I[n2] = r2, e3 = 0; e3 < 1 << w[n2]; e3++) A[r2++] = n2;
            for (A[r2 - 1] = n2, n2 = i2 = 0; n2 < 16; n2++) for (T[n2] = i2, e3 = 0; e3 < 1 << k[n2]; e3++) E[i2++] = n2;
            for (i2 >>= 7; n2 < f; n2++) for (T[n2] = i2 << 7, e3 = 0; e3 < 1 << k[n2] - 7; e3++) E[256 + i2++] = n2;
            for (t2 = 0; t2 <= g; t2++) s2[t2] = 0;
            for (e3 = 0; e3 <= 143; ) z[2 * e3 + 1] = 8, e3++, s2[8]++;
            for (; e3 <= 255; ) z[2 * e3 + 1] = 9, e3++, s2[9]++;
            for (; e3 <= 279; ) z[2 * e3 + 1] = 7, e3++, s2[7]++;
            for (; e3 <= 287; ) z[2 * e3 + 1] = 8, e3++, s2[8]++;
            for (Z(z, l + 1, s2), e3 = 0; e3 < f; e3++) C[2 * e3 + 1] = 5, C[2 * e3] = j(e3, 5);
            O = new D(z, w, u + 1, l, g), B = new D(C, k, 0, f, g), R = new D(new Array(0), x, 0, c, p);
          })(), q = true), e2.l_desc = new F(e2.dyn_ltree, O), e2.d_desc = new F(e2.dyn_dtree, B), e2.bl_desc = new F(e2.bl_tree, R), e2.bi_buf = 0, e2.bi_valid = 0, W(e2);
        }, r._tr_stored_block = J, r._tr_flush_block = function(e2, t2, r2, n2) {
          var i2, s2, a2 = 0;
          0 < e2.level ? (2 === e2.strm.data_type && (e2.strm.data_type = (function(e3) {
            var t3, r3 = 4093624447;
            for (t3 = 0; t3 <= 31; t3++, r3 >>>= 1) if (1 & r3 && 0 !== e3.dyn_ltree[2 * t3]) return o;
            if (0 !== e3.dyn_ltree[18] || 0 !== e3.dyn_ltree[20] || 0 !== e3.dyn_ltree[26]) return h;
            for (t3 = 32; t3 < u; t3++) if (0 !== e3.dyn_ltree[2 * t3]) return h;
            return o;
          })(e2)), Y(e2, e2.l_desc), Y(e2, e2.d_desc), a2 = (function(e3) {
            var t3;
            for (X(e3, e3.dyn_ltree, e3.l_desc.max_code), X(e3, e3.dyn_dtree, e3.d_desc.max_code), Y(e3, e3.bl_desc), t3 = c - 1; 3 <= t3 && 0 === e3.bl_tree[2 * S[t3] + 1]; t3--) ;
            return e3.opt_len += 3 * (t3 + 1) + 5 + 5 + 4, t3;
          })(e2), i2 = e2.opt_len + 3 + 7 >>> 3, (s2 = e2.static_len + 3 + 7 >>> 3) <= i2 && (i2 = s2)) : i2 = s2 = r2 + 5, r2 + 4 <= i2 && -1 !== t2 ? J(e2, t2, r2, n2) : 4 === e2.strategy || s2 === i2 ? (P(e2, 2 + (n2 ? 1 : 0), 3), K(e2, z, C)) : (P(e2, 4 + (n2 ? 1 : 0), 3), (function(e3, t3, r3, n3) {
            var i3;
            for (P(e3, t3 - 257, 5), P(e3, r3 - 1, 5), P(e3, n3 - 4, 4), i3 = 0; i3 < n3; i3++) P(e3, e3.bl_tree[2 * S[i3] + 1], 3);
            V(e3, e3.dyn_ltree, t3 - 1), V(e3, e3.dyn_dtree, r3 - 1);
          })(e2, e2.l_desc.max_code + 1, e2.d_desc.max_code + 1, a2 + 1), K(e2, e2.dyn_ltree, e2.dyn_dtree)), W(e2), n2 && M(e2);
        }, r._tr_tally = function(e2, t2, r2) {
          return e2.pending_buf[e2.d_buf + 2 * e2.last_lit] = t2 >>> 8 & 255, e2.pending_buf[e2.d_buf + 2 * e2.last_lit + 1] = 255 & t2, e2.pending_buf[e2.l_buf + e2.last_lit] = 255 & r2, e2.last_lit++, 0 === t2 ? e2.dyn_ltree[2 * r2]++ : (e2.matches++, t2--, e2.dyn_ltree[2 * (A[r2] + u + 1)]++, e2.dyn_dtree[2 * N(t2)]++), e2.last_lit === e2.lit_bufsize - 1;
        }, r._tr_align = function(e2) {
          P(e2, 2, 3), L(e2, m, z), (function(e3) {
            16 === e3.bi_valid ? (U(e3, e3.bi_buf), e3.bi_buf = 0, e3.bi_valid = 0) : 8 <= e3.bi_valid && (e3.pending_buf[e3.pending++] = 255 & e3.bi_buf, e3.bi_buf >>= 8, e3.bi_valid -= 8);
          })(e2);
        };
      }, { "../utils/common": 41 }], 53: [function(e, t, r) {
        "use strict";
        t.exports = function() {
          this.input = null, this.next_in = 0, this.avail_in = 0, this.total_in = 0, this.output = null, this.next_out = 0, this.avail_out = 0, this.total_out = 0, this.msg = "", this.state = null, this.data_type = 2, this.adler = 0;
        };
      }, {}], 54: [function(e, t, r) {
        (function(e2) {
          !(function(r2, n) {
            "use strict";
            if (!r2.setImmediate) {
              var i, s, t2, a, o = 1, h = {}, u = false, l = r2.document, e3 = Object.getPrototypeOf && Object.getPrototypeOf(r2);
              e3 = e3 && e3.setTimeout ? e3 : r2, i = "[object process]" === {}.toString.call(r2.process) ? function(e4) {
                process.nextTick(function() {
                  c(e4);
                });
              } : (function() {
                if (r2.postMessage && !r2.importScripts) {
                  var e4 = true, t3 = r2.onmessage;
                  return r2.onmessage = function() {
                    e4 = false;
                  }, r2.postMessage("", "*"), r2.onmessage = t3, e4;
                }
              })() ? (a = "setImmediate$" + Math.random() + "$", r2.addEventListener ? r2.addEventListener("message", d, false) : r2.attachEvent("onmessage", d), function(e4) {
                r2.postMessage(a + e4, "*");
              }) : r2.MessageChannel ? ((t2 = new MessageChannel()).port1.onmessage = function(e4) {
                c(e4.data);
              }, function(e4) {
                t2.port2.postMessage(e4);
              }) : l && "onreadystatechange" in l.createElement("script") ? (s = l.documentElement, function(e4) {
                var t3 = l.createElement("script");
                t3.onreadystatechange = function() {
                  c(e4), t3.onreadystatechange = null, s.removeChild(t3), t3 = null;
                }, s.appendChild(t3);
              }) : function(e4) {
                setTimeout(c, 0, e4);
              }, e3.setImmediate = function(e4) {
                "function" != typeof e4 && (e4 = new Function("" + e4));
                for (var t3 = new Array(arguments.length - 1), r3 = 0; r3 < t3.length; r3++) t3[r3] = arguments[r3 + 1];
                var n2 = { callback: e4, args: t3 };
                return h[o] = n2, i(o), o++;
              }, e3.clearImmediate = f;
            }
            function f(e4) {
              delete h[e4];
            }
            function c(e4) {
              if (u) setTimeout(c, 0, e4);
              else {
                var t3 = h[e4];
                if (t3) {
                  u = true;
                  try {
                    !(function(e5) {
                      var t4 = e5.callback, r3 = e5.args;
                      switch (r3.length) {
                        case 0:
                          t4();
                          break;
                        case 1:
                          t4(r3[0]);
                          break;
                        case 2:
                          t4(r3[0], r3[1]);
                          break;
                        case 3:
                          t4(r3[0], r3[1], r3[2]);
                          break;
                        default:
                          t4.apply(n, r3);
                      }
                    })(t3);
                  } finally {
                    f(e4), u = false;
                  }
                }
              }
            }
            function d(e4) {
              e4.source === r2 && "string" == typeof e4.data && 0 === e4.data.indexOf(a) && c(+e4.data.slice(a.length));
            }
          })("undefined" == typeof self ? void 0 === e2 ? this : e2 : self);
        }).call(this, "undefined" != typeof global ? global : "undefined" != typeof self ? self : "undefined" != typeof window ? window : {});
      }, {}] }, {}, [10])(10);
    });
  }
});

// (disabled):node:fs
var require_node_fs = __commonJS({
  "(disabled):node:fs"() {
  }
});

// (disabled):node:https
var require_node_https = __commonJS({
  "(disabled):node:https"() {
  }
});

// node_modules/pptxgenjs/dist/pptxgen.es.js
var import_jszip = __toESM(require_jszip_min());
function __awaiter(thisArg, _arguments, P, generator) {
  function adopt(value) {
    return value instanceof P ? value : new P(function(resolve) {
      resolve(value);
    });
  }
  return new (P || (P = Promise))(function(resolve, reject) {
    function fulfilled(value) {
      try {
        step(generator.next(value));
      } catch (e) {
        reject(e);
      }
    }
    function rejected(value) {
      try {
        step(generator["throw"](value));
      } catch (e) {
        reject(e);
      }
    }
    function step(result) {
      result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected);
    }
    step((generator = generator.apply(thisArg, _arguments || [])).next());
  });
}
var EMU = 914400;
var ONEPT = 12700;
var CRLF = "\r\n";
var LAYOUT_IDX_SERIES_BASE = 2147483649;
var REGEX_HEX_COLOR = /^[0-9a-fA-F]{6}$/;
var LINEH_MODIFIER = 1.67;
var DEF_BULLET_MARGIN = 27;
var DEF_CELL_BORDER = { type: "solid", color: "666666", pt: 1 };
var DEF_CELL_MARGIN_IN = [0.05, 0.1, 0.05, 0.1];
var DEF_CHART_BORDER = { color: "363636", pt: 1 };
var DEF_CHART_GRIDLINE = { color: "888888", style: "solid", size: 1, cap: "flat" };
var DEF_FONT_COLOR = "000000";
var DEF_FONT_SIZE = 12;
var DEF_FONT_TITLE_SIZE = 18;
var DEF_PRES_LAYOUT = "LAYOUT_16x9";
var DEF_PRES_LAYOUT_NAME = "DEFAULT";
var DEF_SHAPE_LINE_COLOR = "333333";
var DEF_SHAPE_SHADOW = { type: "outer", blur: 3, offset: 23e3 / 12700, angle: 90, color: "000000", opacity: 0.35, rotateWithShape: true };
var DEF_SLIDE_MARGIN_IN = [0.5, 0.5, 0.5, 0.5];
var DEF_TEXT_SHADOW = { color: "000000" };
var DEF_TEXT_GLOW = { size: 8, color: "FFFFFF", opacity: 0.75 };
var AXIS_ID_VALUE_PRIMARY = "2094734552";
var AXIS_ID_VALUE_SECONDARY = "2094734553";
var AXIS_ID_CATEGORY_PRIMARY = "2094734554";
var AXIS_ID_CATEGORY_SECONDARY = "2094734555";
var AXIS_ID_SERIES_PRIMARY = "2094734556";
var LETTERS = "ABCDEFGHIJKLMNOPQRSTUVWXYZ".split("");
var BARCHART_COLORS = [
  "C0504D",
  "4F81BD",
  "9BBB59",
  "8064A2",
  "4BACC6",
  "F79646",
  "628FC6",
  "C86360",
  "C0504D",
  "4F81BD",
  "9BBB59",
  "8064A2",
  "4BACC6",
  "F79646",
  "628FC6",
  "C86360"
];
var PIECHART_COLORS = [
  "5DA5DA",
  "FAA43A",
  "60BD68",
  "F17CB0",
  "B2912F",
  "B276B2",
  "DECF3F",
  "F15854",
  "A7A7A7",
  "5DA5DA",
  "FAA43A",
  "60BD68",
  "F17CB0",
  "B2912F",
  "B276B2",
  "DECF3F",
  "F15854",
  "A7A7A7"
];
var TEXT_HALIGN;
(function(TEXT_HALIGN2) {
  TEXT_HALIGN2["left"] = "left";
  TEXT_HALIGN2["center"] = "center";
  TEXT_HALIGN2["right"] = "right";
  TEXT_HALIGN2["justify"] = "justify";
})(TEXT_HALIGN || (TEXT_HALIGN = {}));
var TEXT_VALIGN;
(function(TEXT_VALIGN2) {
  TEXT_VALIGN2["b"] = "b";
  TEXT_VALIGN2["ctr"] = "ctr";
  TEXT_VALIGN2["t"] = "t";
})(TEXT_VALIGN || (TEXT_VALIGN = {}));
var SLDNUMFLDID = "{F7021451-1387-4CA6-816F-3879F97B5CBC}";
var OutputType;
(function(OutputType2) {
  OutputType2["arraybuffer"] = "arraybuffer";
  OutputType2["base64"] = "base64";
  OutputType2["binarystring"] = "binarystring";
  OutputType2["blob"] = "blob";
  OutputType2["nodebuffer"] = "nodebuffer";
  OutputType2["uint8array"] = "uint8array";
})(OutputType || (OutputType = {}));
var ChartType;
(function(ChartType2) {
  ChartType2["area"] = "area";
  ChartType2["bar"] = "bar";
  ChartType2["bar3d"] = "bar3D";
  ChartType2["bubble"] = "bubble";
  ChartType2["bubble3d"] = "bubble3D";
  ChartType2["doughnut"] = "doughnut";
  ChartType2["line"] = "line";
  ChartType2["pie"] = "pie";
  ChartType2["radar"] = "radar";
  ChartType2["scatter"] = "scatter";
})(ChartType || (ChartType = {}));
var ShapeType;
(function(ShapeType2) {
  ShapeType2["accentBorderCallout1"] = "accentBorderCallout1";
  ShapeType2["accentBorderCallout2"] = "accentBorderCallout2";
  ShapeType2["accentBorderCallout3"] = "accentBorderCallout3";
  ShapeType2["accentCallout1"] = "accentCallout1";
  ShapeType2["accentCallout2"] = "accentCallout2";
  ShapeType2["accentCallout3"] = "accentCallout3";
  ShapeType2["actionButtonBackPrevious"] = "actionButtonBackPrevious";
  ShapeType2["actionButtonBeginning"] = "actionButtonBeginning";
  ShapeType2["actionButtonBlank"] = "actionButtonBlank";
  ShapeType2["actionButtonDocument"] = "actionButtonDocument";
  ShapeType2["actionButtonEnd"] = "actionButtonEnd";
  ShapeType2["actionButtonForwardNext"] = "actionButtonForwardNext";
  ShapeType2["actionButtonHelp"] = "actionButtonHelp";
  ShapeType2["actionButtonHome"] = "actionButtonHome";
  ShapeType2["actionButtonInformation"] = "actionButtonInformation";
  ShapeType2["actionButtonMovie"] = "actionButtonMovie";
  ShapeType2["actionButtonReturn"] = "actionButtonReturn";
  ShapeType2["actionButtonSound"] = "actionButtonSound";
  ShapeType2["arc"] = "arc";
  ShapeType2["bentArrow"] = "bentArrow";
  ShapeType2["bentUpArrow"] = "bentUpArrow";
  ShapeType2["bevel"] = "bevel";
  ShapeType2["blockArc"] = "blockArc";
  ShapeType2["borderCallout1"] = "borderCallout1";
  ShapeType2["borderCallout2"] = "borderCallout2";
  ShapeType2["borderCallout3"] = "borderCallout3";
  ShapeType2["bracePair"] = "bracePair";
  ShapeType2["bracketPair"] = "bracketPair";
  ShapeType2["callout1"] = "callout1";
  ShapeType2["callout2"] = "callout2";
  ShapeType2["callout3"] = "callout3";
  ShapeType2["can"] = "can";
  ShapeType2["chartPlus"] = "chartPlus";
  ShapeType2["chartStar"] = "chartStar";
  ShapeType2["chartX"] = "chartX";
  ShapeType2["chevron"] = "chevron";
  ShapeType2["chord"] = "chord";
  ShapeType2["circularArrow"] = "circularArrow";
  ShapeType2["cloud"] = "cloud";
  ShapeType2["cloudCallout"] = "cloudCallout";
  ShapeType2["corner"] = "corner";
  ShapeType2["cornerTabs"] = "cornerTabs";
  ShapeType2["cube"] = "cube";
  ShapeType2["curvedDownArrow"] = "curvedDownArrow";
  ShapeType2["curvedLeftArrow"] = "curvedLeftArrow";
  ShapeType2["curvedRightArrow"] = "curvedRightArrow";
  ShapeType2["curvedUpArrow"] = "curvedUpArrow";
  ShapeType2["custGeom"] = "custGeom";
  ShapeType2["decagon"] = "decagon";
  ShapeType2["diagStripe"] = "diagStripe";
  ShapeType2["diamond"] = "diamond";
  ShapeType2["dodecagon"] = "dodecagon";
  ShapeType2["donut"] = "donut";
  ShapeType2["doubleWave"] = "doubleWave";
  ShapeType2["downArrow"] = "downArrow";
  ShapeType2["downArrowCallout"] = "downArrowCallout";
  ShapeType2["ellipse"] = "ellipse";
  ShapeType2["ellipseRibbon"] = "ellipseRibbon";
  ShapeType2["ellipseRibbon2"] = "ellipseRibbon2";
  ShapeType2["flowChartAlternateProcess"] = "flowChartAlternateProcess";
  ShapeType2["flowChartCollate"] = "flowChartCollate";
  ShapeType2["flowChartConnector"] = "flowChartConnector";
  ShapeType2["flowChartDecision"] = "flowChartDecision";
  ShapeType2["flowChartDelay"] = "flowChartDelay";
  ShapeType2["flowChartDisplay"] = "flowChartDisplay";
  ShapeType2["flowChartDocument"] = "flowChartDocument";
  ShapeType2["flowChartExtract"] = "flowChartExtract";
  ShapeType2["flowChartInputOutput"] = "flowChartInputOutput";
  ShapeType2["flowChartInternalStorage"] = "flowChartInternalStorage";
  ShapeType2["flowChartMagneticDisk"] = "flowChartMagneticDisk";
  ShapeType2["flowChartMagneticDrum"] = "flowChartMagneticDrum";
  ShapeType2["flowChartMagneticTape"] = "flowChartMagneticTape";
  ShapeType2["flowChartManualInput"] = "flowChartManualInput";
  ShapeType2["flowChartManualOperation"] = "flowChartManualOperation";
  ShapeType2["flowChartMerge"] = "flowChartMerge";
  ShapeType2["flowChartMultidocument"] = "flowChartMultidocument";
  ShapeType2["flowChartOfflineStorage"] = "flowChartOfflineStorage";
  ShapeType2["flowChartOffpageConnector"] = "flowChartOffpageConnector";
  ShapeType2["flowChartOnlineStorage"] = "flowChartOnlineStorage";
  ShapeType2["flowChartOr"] = "flowChartOr";
  ShapeType2["flowChartPredefinedProcess"] = "flowChartPredefinedProcess";
  ShapeType2["flowChartPreparation"] = "flowChartPreparation";
  ShapeType2["flowChartProcess"] = "flowChartProcess";
  ShapeType2["flowChartPunchedCard"] = "flowChartPunchedCard";
  ShapeType2["flowChartPunchedTape"] = "flowChartPunchedTape";
  ShapeType2["flowChartSort"] = "flowChartSort";
  ShapeType2["flowChartSummingJunction"] = "flowChartSummingJunction";
  ShapeType2["flowChartTerminator"] = "flowChartTerminator";
  ShapeType2["folderCorner"] = "folderCorner";
  ShapeType2["frame"] = "frame";
  ShapeType2["funnel"] = "funnel";
  ShapeType2["gear6"] = "gear6";
  ShapeType2["gear9"] = "gear9";
  ShapeType2["halfFrame"] = "halfFrame";
  ShapeType2["heart"] = "heart";
  ShapeType2["heptagon"] = "heptagon";
  ShapeType2["hexagon"] = "hexagon";
  ShapeType2["homePlate"] = "homePlate";
  ShapeType2["horizontalScroll"] = "horizontalScroll";
  ShapeType2["irregularSeal1"] = "irregularSeal1";
  ShapeType2["irregularSeal2"] = "irregularSeal2";
  ShapeType2["leftArrow"] = "leftArrow";
  ShapeType2["leftArrowCallout"] = "leftArrowCallout";
  ShapeType2["leftBrace"] = "leftBrace";
  ShapeType2["leftBracket"] = "leftBracket";
  ShapeType2["leftCircularArrow"] = "leftCircularArrow";
  ShapeType2["leftRightArrow"] = "leftRightArrow";
  ShapeType2["leftRightArrowCallout"] = "leftRightArrowCallout";
  ShapeType2["leftRightCircularArrow"] = "leftRightCircularArrow";
  ShapeType2["leftRightRibbon"] = "leftRightRibbon";
  ShapeType2["leftRightUpArrow"] = "leftRightUpArrow";
  ShapeType2["leftUpArrow"] = "leftUpArrow";
  ShapeType2["lightningBolt"] = "lightningBolt";
  ShapeType2["line"] = "line";
  ShapeType2["lineInv"] = "lineInv";
  ShapeType2["mathDivide"] = "mathDivide";
  ShapeType2["mathEqual"] = "mathEqual";
  ShapeType2["mathMinus"] = "mathMinus";
  ShapeType2["mathMultiply"] = "mathMultiply";
  ShapeType2["mathNotEqual"] = "mathNotEqual";
  ShapeType2["mathPlus"] = "mathPlus";
  ShapeType2["moon"] = "moon";
  ShapeType2["noSmoking"] = "noSmoking";
  ShapeType2["nonIsoscelesTrapezoid"] = "nonIsoscelesTrapezoid";
  ShapeType2["notchedRightArrow"] = "notchedRightArrow";
  ShapeType2["octagon"] = "octagon";
  ShapeType2["parallelogram"] = "parallelogram";
  ShapeType2["pentagon"] = "pentagon";
  ShapeType2["pie"] = "pie";
  ShapeType2["pieWedge"] = "pieWedge";
  ShapeType2["plaque"] = "plaque";
  ShapeType2["plaqueTabs"] = "plaqueTabs";
  ShapeType2["plus"] = "plus";
  ShapeType2["quadArrow"] = "quadArrow";
  ShapeType2["quadArrowCallout"] = "quadArrowCallout";
  ShapeType2["rect"] = "rect";
  ShapeType2["ribbon"] = "ribbon";
  ShapeType2["ribbon2"] = "ribbon2";
  ShapeType2["rightArrow"] = "rightArrow";
  ShapeType2["rightArrowCallout"] = "rightArrowCallout";
  ShapeType2["rightBrace"] = "rightBrace";
  ShapeType2["rightBracket"] = "rightBracket";
  ShapeType2["round1Rect"] = "round1Rect";
  ShapeType2["round2DiagRect"] = "round2DiagRect";
  ShapeType2["round2SameRect"] = "round2SameRect";
  ShapeType2["roundRect"] = "roundRect";
  ShapeType2["rtTriangle"] = "rtTriangle";
  ShapeType2["smileyFace"] = "smileyFace";
  ShapeType2["snip1Rect"] = "snip1Rect";
  ShapeType2["snip2DiagRect"] = "snip2DiagRect";
  ShapeType2["snip2SameRect"] = "snip2SameRect";
  ShapeType2["snipRoundRect"] = "snipRoundRect";
  ShapeType2["squareTabs"] = "squareTabs";
  ShapeType2["star10"] = "star10";
  ShapeType2["star12"] = "star12";
  ShapeType2["star16"] = "star16";
  ShapeType2["star24"] = "star24";
  ShapeType2["star32"] = "star32";
  ShapeType2["star4"] = "star4";
  ShapeType2["star5"] = "star5";
  ShapeType2["star6"] = "star6";
  ShapeType2["star7"] = "star7";
  ShapeType2["star8"] = "star8";
  ShapeType2["stripedRightArrow"] = "stripedRightArrow";
  ShapeType2["sun"] = "sun";
  ShapeType2["swooshArrow"] = "swooshArrow";
  ShapeType2["teardrop"] = "teardrop";
  ShapeType2["trapezoid"] = "trapezoid";
  ShapeType2["triangle"] = "triangle";
  ShapeType2["upArrow"] = "upArrow";
  ShapeType2["upArrowCallout"] = "upArrowCallout";
  ShapeType2["upDownArrow"] = "upDownArrow";
  ShapeType2["upDownArrowCallout"] = "upDownArrowCallout";
  ShapeType2["uturnArrow"] = "uturnArrow";
  ShapeType2["verticalScroll"] = "verticalScroll";
  ShapeType2["wave"] = "wave";
  ShapeType2["wedgeEllipseCallout"] = "wedgeEllipseCallout";
  ShapeType2["wedgeRectCallout"] = "wedgeRectCallout";
  ShapeType2["wedgeRoundRectCallout"] = "wedgeRoundRectCallout";
})(ShapeType || (ShapeType = {}));
var SchemeColor;
(function(SchemeColor2) {
  SchemeColor2["text1"] = "tx1";
  SchemeColor2["text2"] = "tx2";
  SchemeColor2["background1"] = "bg1";
  SchemeColor2["background2"] = "bg2";
  SchemeColor2["accent1"] = "accent1";
  SchemeColor2["accent2"] = "accent2";
  SchemeColor2["accent3"] = "accent3";
  SchemeColor2["accent4"] = "accent4";
  SchemeColor2["accent5"] = "accent5";
  SchemeColor2["accent6"] = "accent6";
})(SchemeColor || (SchemeColor = {}));
var AlignH;
(function(AlignH2) {
  AlignH2["left"] = "left";
  AlignH2["center"] = "center";
  AlignH2["right"] = "right";
  AlignH2["justify"] = "justify";
})(AlignH || (AlignH = {}));
var AlignV;
(function(AlignV2) {
  AlignV2["top"] = "top";
  AlignV2["middle"] = "middle";
  AlignV2["bottom"] = "bottom";
})(AlignV || (AlignV = {}));
var SHAPE_TYPE;
(function(SHAPE_TYPE2) {
  SHAPE_TYPE2["ACTION_BUTTON_BACK_OR_PREVIOUS"] = "actionButtonBackPrevious";
  SHAPE_TYPE2["ACTION_BUTTON_BEGINNING"] = "actionButtonBeginning";
  SHAPE_TYPE2["ACTION_BUTTON_CUSTOM"] = "actionButtonBlank";
  SHAPE_TYPE2["ACTION_BUTTON_DOCUMENT"] = "actionButtonDocument";
  SHAPE_TYPE2["ACTION_BUTTON_END"] = "actionButtonEnd";
  SHAPE_TYPE2["ACTION_BUTTON_FORWARD_OR_NEXT"] = "actionButtonForwardNext";
  SHAPE_TYPE2["ACTION_BUTTON_HELP"] = "actionButtonHelp";
  SHAPE_TYPE2["ACTION_BUTTON_HOME"] = "actionButtonHome";
  SHAPE_TYPE2["ACTION_BUTTON_INFORMATION"] = "actionButtonInformation";
  SHAPE_TYPE2["ACTION_BUTTON_MOVIE"] = "actionButtonMovie";
  SHAPE_TYPE2["ACTION_BUTTON_RETURN"] = "actionButtonReturn";
  SHAPE_TYPE2["ACTION_BUTTON_SOUND"] = "actionButtonSound";
  SHAPE_TYPE2["ARC"] = "arc";
  SHAPE_TYPE2["BALLOON"] = "wedgeRoundRectCallout";
  SHAPE_TYPE2["BENT_ARROW"] = "bentArrow";
  SHAPE_TYPE2["BENT_UP_ARROW"] = "bentUpArrow";
  SHAPE_TYPE2["BEVEL"] = "bevel";
  SHAPE_TYPE2["BLOCK_ARC"] = "blockArc";
  SHAPE_TYPE2["CAN"] = "can";
  SHAPE_TYPE2["CHART_PLUS"] = "chartPlus";
  SHAPE_TYPE2["CHART_STAR"] = "chartStar";
  SHAPE_TYPE2["CHART_X"] = "chartX";
  SHAPE_TYPE2["CHEVRON"] = "chevron";
  SHAPE_TYPE2["CHORD"] = "chord";
  SHAPE_TYPE2["CIRCULAR_ARROW"] = "circularArrow";
  SHAPE_TYPE2["CLOUD"] = "cloud";
  SHAPE_TYPE2["CLOUD_CALLOUT"] = "cloudCallout";
  SHAPE_TYPE2["CORNER"] = "corner";
  SHAPE_TYPE2["CORNER_TABS"] = "cornerTabs";
  SHAPE_TYPE2["CROSS"] = "plus";
  SHAPE_TYPE2["CUBE"] = "cube";
  SHAPE_TYPE2["CURVED_DOWN_ARROW"] = "curvedDownArrow";
  SHAPE_TYPE2["CURVED_DOWN_RIBBON"] = "ellipseRibbon";
  SHAPE_TYPE2["CURVED_LEFT_ARROW"] = "curvedLeftArrow";
  SHAPE_TYPE2["CURVED_RIGHT_ARROW"] = "curvedRightArrow";
  SHAPE_TYPE2["CURVED_UP_ARROW"] = "curvedUpArrow";
  SHAPE_TYPE2["CURVED_UP_RIBBON"] = "ellipseRibbon2";
  SHAPE_TYPE2["CUSTOM_GEOMETRY"] = "custGeom";
  SHAPE_TYPE2["DECAGON"] = "decagon";
  SHAPE_TYPE2["DIAGONAL_STRIPE"] = "diagStripe";
  SHAPE_TYPE2["DIAMOND"] = "diamond";
  SHAPE_TYPE2["DODECAGON"] = "dodecagon";
  SHAPE_TYPE2["DONUT"] = "donut";
  SHAPE_TYPE2["DOUBLE_BRACE"] = "bracePair";
  SHAPE_TYPE2["DOUBLE_BRACKET"] = "bracketPair";
  SHAPE_TYPE2["DOUBLE_WAVE"] = "doubleWave";
  SHAPE_TYPE2["DOWN_ARROW"] = "downArrow";
  SHAPE_TYPE2["DOWN_ARROW_CALLOUT"] = "downArrowCallout";
  SHAPE_TYPE2["DOWN_RIBBON"] = "ribbon";
  SHAPE_TYPE2["EXPLOSION1"] = "irregularSeal1";
  SHAPE_TYPE2["EXPLOSION2"] = "irregularSeal2";
  SHAPE_TYPE2["FLOWCHART_ALTERNATE_PROCESS"] = "flowChartAlternateProcess";
  SHAPE_TYPE2["FLOWCHART_CARD"] = "flowChartPunchedCard";
  SHAPE_TYPE2["FLOWCHART_COLLATE"] = "flowChartCollate";
  SHAPE_TYPE2["FLOWCHART_CONNECTOR"] = "flowChartConnector";
  SHAPE_TYPE2["FLOWCHART_DATA"] = "flowChartInputOutput";
  SHAPE_TYPE2["FLOWCHART_DECISION"] = "flowChartDecision";
  SHAPE_TYPE2["FLOWCHART_DELAY"] = "flowChartDelay";
  SHAPE_TYPE2["FLOWCHART_DIRECT_ACCESS_STORAGE"] = "flowChartMagneticDrum";
  SHAPE_TYPE2["FLOWCHART_DISPLAY"] = "flowChartDisplay";
  SHAPE_TYPE2["FLOWCHART_DOCUMENT"] = "flowChartDocument";
  SHAPE_TYPE2["FLOWCHART_EXTRACT"] = "flowChartExtract";
  SHAPE_TYPE2["FLOWCHART_INTERNAL_STORAGE"] = "flowChartInternalStorage";
  SHAPE_TYPE2["FLOWCHART_MAGNETIC_DISK"] = "flowChartMagneticDisk";
  SHAPE_TYPE2["FLOWCHART_MANUAL_INPUT"] = "flowChartManualInput";
  SHAPE_TYPE2["FLOWCHART_MANUAL_OPERATION"] = "flowChartManualOperation";
  SHAPE_TYPE2["FLOWCHART_MERGE"] = "flowChartMerge";
  SHAPE_TYPE2["FLOWCHART_MULTIDOCUMENT"] = "flowChartMultidocument";
  SHAPE_TYPE2["FLOWCHART_OFFLINE_STORAGE"] = "flowChartOfflineStorage";
  SHAPE_TYPE2["FLOWCHART_OFFPAGE_CONNECTOR"] = "flowChartOffpageConnector";
  SHAPE_TYPE2["FLOWCHART_OR"] = "flowChartOr";
  SHAPE_TYPE2["FLOWCHART_PREDEFINED_PROCESS"] = "flowChartPredefinedProcess";
  SHAPE_TYPE2["FLOWCHART_PREPARATION"] = "flowChartPreparation";
  SHAPE_TYPE2["FLOWCHART_PROCESS"] = "flowChartProcess";
  SHAPE_TYPE2["FLOWCHART_PUNCHED_TAPE"] = "flowChartPunchedTape";
  SHAPE_TYPE2["FLOWCHART_SEQUENTIAL_ACCESS_STORAGE"] = "flowChartMagneticTape";
  SHAPE_TYPE2["FLOWCHART_SORT"] = "flowChartSort";
  SHAPE_TYPE2["FLOWCHART_STORED_DATA"] = "flowChartOnlineStorage";
  SHAPE_TYPE2["FLOWCHART_SUMMING_JUNCTION"] = "flowChartSummingJunction";
  SHAPE_TYPE2["FLOWCHART_TERMINATOR"] = "flowChartTerminator";
  SHAPE_TYPE2["FOLDED_CORNER"] = "folderCorner";
  SHAPE_TYPE2["FRAME"] = "frame";
  SHAPE_TYPE2["FUNNEL"] = "funnel";
  SHAPE_TYPE2["GEAR_6"] = "gear6";
  SHAPE_TYPE2["GEAR_9"] = "gear9";
  SHAPE_TYPE2["HALF_FRAME"] = "halfFrame";
  SHAPE_TYPE2["HEART"] = "heart";
  SHAPE_TYPE2["HEPTAGON"] = "heptagon";
  SHAPE_TYPE2["HEXAGON"] = "hexagon";
  SHAPE_TYPE2["HORIZONTAL_SCROLL"] = "horizontalScroll";
  SHAPE_TYPE2["ISOSCELES_TRIANGLE"] = "triangle";
  SHAPE_TYPE2["LEFT_ARROW"] = "leftArrow";
  SHAPE_TYPE2["LEFT_ARROW_CALLOUT"] = "leftArrowCallout";
  SHAPE_TYPE2["LEFT_BRACE"] = "leftBrace";
  SHAPE_TYPE2["LEFT_BRACKET"] = "leftBracket";
  SHAPE_TYPE2["LEFT_CIRCULAR_ARROW"] = "leftCircularArrow";
  SHAPE_TYPE2["LEFT_RIGHT_ARROW"] = "leftRightArrow";
  SHAPE_TYPE2["LEFT_RIGHT_ARROW_CALLOUT"] = "leftRightArrowCallout";
  SHAPE_TYPE2["LEFT_RIGHT_CIRCULAR_ARROW"] = "leftRightCircularArrow";
  SHAPE_TYPE2["LEFT_RIGHT_RIBBON"] = "leftRightRibbon";
  SHAPE_TYPE2["LEFT_RIGHT_UP_ARROW"] = "leftRightUpArrow";
  SHAPE_TYPE2["LEFT_UP_ARROW"] = "leftUpArrow";
  SHAPE_TYPE2["LIGHTNING_BOLT"] = "lightningBolt";
  SHAPE_TYPE2["LINE_CALLOUT_1"] = "borderCallout1";
  SHAPE_TYPE2["LINE_CALLOUT_1_ACCENT_BAR"] = "accentCallout1";
  SHAPE_TYPE2["LINE_CALLOUT_1_BORDER_AND_ACCENT_BAR"] = "accentBorderCallout1";
  SHAPE_TYPE2["LINE_CALLOUT_1_NO_BORDER"] = "callout1";
  SHAPE_TYPE2["LINE_CALLOUT_2"] = "borderCallout2";
  SHAPE_TYPE2["LINE_CALLOUT_2_ACCENT_BAR"] = "accentCallout2";
  SHAPE_TYPE2["LINE_CALLOUT_2_BORDER_AND_ACCENT_BAR"] = "accentBorderCallout2";
  SHAPE_TYPE2["LINE_CALLOUT_2_NO_BORDER"] = "callout2";
  SHAPE_TYPE2["LINE_CALLOUT_3"] = "borderCallout3";
  SHAPE_TYPE2["LINE_CALLOUT_3_ACCENT_BAR"] = "accentCallout3";
  SHAPE_TYPE2["LINE_CALLOUT_3_BORDER_AND_ACCENT_BAR"] = "accentBorderCallout3";
  SHAPE_TYPE2["LINE_CALLOUT_3_NO_BORDER"] = "callout3";
  SHAPE_TYPE2["LINE_CALLOUT_4"] = "borderCallout4";
  SHAPE_TYPE2["LINE_CALLOUT_4_ACCENT_BAR"] = "accentCallout3=4";
  SHAPE_TYPE2["LINE_CALLOUT_4_BORDER_AND_ACCENT_BAR"] = "accentBorderCallout4";
  SHAPE_TYPE2["LINE_CALLOUT_4_NO_BORDER"] = "callout4";
  SHAPE_TYPE2["LINE"] = "line";
  SHAPE_TYPE2["LINE_INVERSE"] = "lineInv";
  SHAPE_TYPE2["MATH_DIVIDE"] = "mathDivide";
  SHAPE_TYPE2["MATH_EQUAL"] = "mathEqual";
  SHAPE_TYPE2["MATH_MINUS"] = "mathMinus";
  SHAPE_TYPE2["MATH_MULTIPLY"] = "mathMultiply";
  SHAPE_TYPE2["MATH_NOT_EQUAL"] = "mathNotEqual";
  SHAPE_TYPE2["MATH_PLUS"] = "mathPlus";
  SHAPE_TYPE2["MOON"] = "moon";
  SHAPE_TYPE2["NON_ISOSCELES_TRAPEZOID"] = "nonIsoscelesTrapezoid";
  SHAPE_TYPE2["NOTCHED_RIGHT_ARROW"] = "notchedRightArrow";
  SHAPE_TYPE2["NO_SYMBOL"] = "noSmoking";
  SHAPE_TYPE2["OCTAGON"] = "octagon";
  SHAPE_TYPE2["OVAL"] = "ellipse";
  SHAPE_TYPE2["OVAL_CALLOUT"] = "wedgeEllipseCallout";
  SHAPE_TYPE2["PARALLELOGRAM"] = "parallelogram";
  SHAPE_TYPE2["PENTAGON"] = "homePlate";
  SHAPE_TYPE2["PIE"] = "pie";
  SHAPE_TYPE2["PIE_WEDGE"] = "pieWedge";
  SHAPE_TYPE2["PLAQUE"] = "plaque";
  SHAPE_TYPE2["PLAQUE_TABS"] = "plaqueTabs";
  SHAPE_TYPE2["QUAD_ARROW"] = "quadArrow";
  SHAPE_TYPE2["QUAD_ARROW_CALLOUT"] = "quadArrowCallout";
  SHAPE_TYPE2["RECTANGLE"] = "rect";
  SHAPE_TYPE2["RECTANGULAR_CALLOUT"] = "wedgeRectCallout";
  SHAPE_TYPE2["REGULAR_PENTAGON"] = "pentagon";
  SHAPE_TYPE2["RIGHT_ARROW"] = "rightArrow";
  SHAPE_TYPE2["RIGHT_ARROW_CALLOUT"] = "rightArrowCallout";
  SHAPE_TYPE2["RIGHT_BRACE"] = "rightBrace";
  SHAPE_TYPE2["RIGHT_BRACKET"] = "rightBracket";
  SHAPE_TYPE2["RIGHT_TRIANGLE"] = "rtTriangle";
  SHAPE_TYPE2["ROUNDED_RECTANGLE"] = "roundRect";
  SHAPE_TYPE2["ROUNDED_RECTANGULAR_CALLOUT"] = "wedgeRoundRectCallout";
  SHAPE_TYPE2["ROUND_1_RECTANGLE"] = "round1Rect";
  SHAPE_TYPE2["ROUND_2_DIAG_RECTANGLE"] = "round2DiagRect";
  SHAPE_TYPE2["ROUND_2_SAME_RECTANGLE"] = "round2SameRect";
  SHAPE_TYPE2["SMILEY_FACE"] = "smileyFace";
  SHAPE_TYPE2["SNIP_1_RECTANGLE"] = "snip1Rect";
  SHAPE_TYPE2["SNIP_2_DIAG_RECTANGLE"] = "snip2DiagRect";
  SHAPE_TYPE2["SNIP_2_SAME_RECTANGLE"] = "snip2SameRect";
  SHAPE_TYPE2["SNIP_ROUND_RECTANGLE"] = "snipRoundRect";
  SHAPE_TYPE2["SQUARE_TABS"] = "squareTabs";
  SHAPE_TYPE2["STAR_10_POINT"] = "star10";
  SHAPE_TYPE2["STAR_12_POINT"] = "star12";
  SHAPE_TYPE2["STAR_16_POINT"] = "star16";
  SHAPE_TYPE2["STAR_24_POINT"] = "star24";
  SHAPE_TYPE2["STAR_32_POINT"] = "star32";
  SHAPE_TYPE2["STAR_4_POINT"] = "star4";
  SHAPE_TYPE2["STAR_5_POINT"] = "star5";
  SHAPE_TYPE2["STAR_6_POINT"] = "star6";
  SHAPE_TYPE2["STAR_7_POINT"] = "star7";
  SHAPE_TYPE2["STAR_8_POINT"] = "star8";
  SHAPE_TYPE2["STRIPED_RIGHT_ARROW"] = "stripedRightArrow";
  SHAPE_TYPE2["SUN"] = "sun";
  SHAPE_TYPE2["SWOOSH_ARROW"] = "swooshArrow";
  SHAPE_TYPE2["TEAR"] = "teardrop";
  SHAPE_TYPE2["TRAPEZOID"] = "trapezoid";
  SHAPE_TYPE2["UP_ARROW"] = "upArrow";
  SHAPE_TYPE2["UP_ARROW_CALLOUT"] = "upArrowCallout";
  SHAPE_TYPE2["UP_DOWN_ARROW"] = "upDownArrow";
  SHAPE_TYPE2["UP_DOWN_ARROW_CALLOUT"] = "upDownArrowCallout";
  SHAPE_TYPE2["UP_RIBBON"] = "ribbon2";
  SHAPE_TYPE2["U_TURN_ARROW"] = "uturnArrow";
  SHAPE_TYPE2["VERTICAL_SCROLL"] = "verticalScroll";
  SHAPE_TYPE2["WAVE"] = "wave";
})(SHAPE_TYPE || (SHAPE_TYPE = {}));
var CHART_TYPE;
(function(CHART_TYPE2) {
  CHART_TYPE2["AREA"] = "area";
  CHART_TYPE2["BAR"] = "bar";
  CHART_TYPE2["BAR3D"] = "bar3D";
  CHART_TYPE2["BUBBLE"] = "bubble";
  CHART_TYPE2["BUBBLE3D"] = "bubble3D";
  CHART_TYPE2["DOUGHNUT"] = "doughnut";
  CHART_TYPE2["LINE"] = "line";
  CHART_TYPE2["PIE"] = "pie";
  CHART_TYPE2["RADAR"] = "radar";
  CHART_TYPE2["SCATTER"] = "scatter";
})(CHART_TYPE || (CHART_TYPE = {}));
var SCHEME_COLOR_NAMES;
(function(SCHEME_COLOR_NAMES2) {
  SCHEME_COLOR_NAMES2["TEXT1"] = "tx1";
  SCHEME_COLOR_NAMES2["TEXT2"] = "tx2";
  SCHEME_COLOR_NAMES2["BACKGROUND1"] = "bg1";
  SCHEME_COLOR_NAMES2["BACKGROUND2"] = "bg2";
  SCHEME_COLOR_NAMES2["ACCENT1"] = "accent1";
  SCHEME_COLOR_NAMES2["ACCENT2"] = "accent2";
  SCHEME_COLOR_NAMES2["ACCENT3"] = "accent3";
  SCHEME_COLOR_NAMES2["ACCENT4"] = "accent4";
  SCHEME_COLOR_NAMES2["ACCENT5"] = "accent5";
  SCHEME_COLOR_NAMES2["ACCENT6"] = "accent6";
})(SCHEME_COLOR_NAMES || (SCHEME_COLOR_NAMES = {}));
var MASTER_OBJECTS;
(function(MASTER_OBJECTS2) {
  MASTER_OBJECTS2["chart"] = "chart";
  MASTER_OBJECTS2["image"] = "image";
  MASTER_OBJECTS2["line"] = "line";
  MASTER_OBJECTS2["rect"] = "rect";
  MASTER_OBJECTS2["text"] = "text";
  MASTER_OBJECTS2["placeholder"] = "placeholder";
})(MASTER_OBJECTS || (MASTER_OBJECTS = {}));
var SLIDE_OBJECT_TYPES;
(function(SLIDE_OBJECT_TYPES2) {
  SLIDE_OBJECT_TYPES2["chart"] = "chart";
  SLIDE_OBJECT_TYPES2["hyperlink"] = "hyperlink";
  SLIDE_OBJECT_TYPES2["image"] = "image";
  SLIDE_OBJECT_TYPES2["media"] = "media";
  SLIDE_OBJECT_TYPES2["online"] = "online";
  SLIDE_OBJECT_TYPES2["placeholder"] = "placeholder";
  SLIDE_OBJECT_TYPES2["table"] = "table";
  SLIDE_OBJECT_TYPES2["tablecell"] = "tablecell";
  SLIDE_OBJECT_TYPES2["text"] = "text";
  SLIDE_OBJECT_TYPES2["notes"] = "notes";
})(SLIDE_OBJECT_TYPES || (SLIDE_OBJECT_TYPES = {}));
var PLACEHOLDER_TYPES;
(function(PLACEHOLDER_TYPES2) {
  PLACEHOLDER_TYPES2["title"] = "title";
  PLACEHOLDER_TYPES2["body"] = "body";
  PLACEHOLDER_TYPES2["image"] = "pic";
  PLACEHOLDER_TYPES2["chart"] = "chart";
  PLACEHOLDER_TYPES2["table"] = "tbl";
  PLACEHOLDER_TYPES2["media"] = "media";
})(PLACEHOLDER_TYPES || (PLACEHOLDER_TYPES = {}));
var BULLET_TYPES;
(function(BULLET_TYPES2) {
  BULLET_TYPES2["DEFAULT"] = "&#x2022;";
  BULLET_TYPES2["CHECK"] = "&#x2713;";
  BULLET_TYPES2["STAR"] = "&#x2605;";
  BULLET_TYPES2["TRIANGLE"] = "&#x25B6;";
})(BULLET_TYPES || (BULLET_TYPES = {}));
var IMG_BROKEN = "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAGQAAAB3CAYAAAD1oOVhAAAGAUlEQVR4Xu2dT0xcRRzHf7tAYSsc0EBSIq2xEg8mtTGebVzEqOVIolz0siRE4gGTStqKwdpWsXoyGhMuyAVJOHBgqyvLNgonDkabeCBYW/8kTUr0wsJC+Wfm0bfuvn37Znbem9mR9303mJnf/Pb7ed95M7PDI5JIJPYJV5EC7e3t1N/fT62trdqViQCIu+bVgpIHEo/Hqbe3V/sdYVKHyWSSZmZm8ilVA0oeyNjYmEnaVC2Xvr6+qg5fAOJAz4DU1dURGzFSqZRVqtMpAFIGyMjICC0vL9PExIRWKADiAYTNshYWFrRCARAOEFZcCKWtrY0GBgaUTYkBRACIE4rKZwqACALR5RQAqQCIDqcASIVAVDsFQCSAqHQKgEgCUeUUAPEBRIVTAMQnEBvK5OQkbW9vk991CoAEAMQJxc86BUACAhKUUwAkQCBBOAVAAgbi1ykAogCIH6cAiCIgsk4BEIVAZJwCIIqBVLqiBxANQFgXS0tLND4+zl08AogmIG5OSSQS1gGKwgtANAIRcQqAaAbCe6YASBWA2E6xDyeyDUl7+AKQMkDYYevm5mZHabA/Li4uUiaTsYLau8QA4gLE/hU7wajyYtv1hReDAiAOxQcHBymbzark4BkbQKom/X8dp9Npmpqasn4BIAYAYSnYp+4BBEAMUcCwNOCQsAKZnp62NtQOw8WmwT09PUo+ijaHsOMx7GppaaH6+nolH0Z10K2tLVpdXbW6UfV3mNqBdHd3U1NTk2rtlMRfW1uj2dlZAFGirkRQAJEQTWUTAFGprkRsAJEQTWUTAFGprkRsAJEQTWUTAFGprkRsAJEQTWUTAFGprkRsAJEQTWUTAFGprkRsAJEQTWUTAGHqrm8caPzQ0WC1logbeiC7X3xJm0PvUmRzh45cuki1588FAmVn9BO6P3yF9utrqGH0MtW82S8UN9RA9v/4k7InjhcJFTs/TLVXLwmJV67S7vD7tHF5pKi46fYdosdOcOOGG8j1OcqefbFEJD9Q3GCwDhqT31HklS4A8VRgfYM2Op6k3bt/BQJl58J7lPvwg5JYNccepaMry0LPqFA7hCm39+NNyp2J0172b19QysGINj5CsRtpij57musOViH0QPJQXn6J9u7dlYJSFkbrMYolrwvDAJAC+WWdEpQz7FTgECeUCpzi6YxvvqXoM6eEhqnCSgDikEzUKUE7Aw7xuHctKB5OYU3dZlNR9syQdAaAcAYTC0pXF+39c09o2Ik+3EqxVKqiB7hbYAxZkk4pbBaEM+AQofv+wTrFwylBOQNABIGwavdfe4O2pg5elO+86l99nY58/VUF0byrYsjiSFluNlXYrOHcBar7+EogUADEQ0YRGHbzoKAASBkg2+9cpM1rV0tK2QOcXW7bLEFAARAXIF4w2DrDWoeUWaf4hQIgDiA8GPZ2iNfi0Q8UACkAIgrDbrJ385eDxaPLLrEsFAB5oG6lMPJQPLZZZKAACBGVhcG2Q+bmuLu2nk55e4jqPv1IeEoceiBeX7s2zCa5MAqdstl91vfXwaEGsv/rb5TtOFk6tWXOuJGh6KmnhO9sayrMninPx103JBtXblHkice58cINZP4Hyr5wpkgkdiChEmc4FWazLzenNKa/p0jncwDiqcD6BuWePk07t1asatZGoYQzSqA4nFJ7soNiP/+EUyfc25GI2GG53dHPrKo1g/1Cw4pIXLrzO+1c+/wg7tBbFDle/EbQcjFCPWQJCau5EoBoFpzXHYDwFNJcDiCaBed1ByA8hTSXA4hmwXndAQhPIc3lAKJZcF53AMJTSHM5gGgWnNcdgPAU0lwOIJoF53UHIDyFNJcfSiCdnZ0Ui8U0SxlMd7lcjubn561gh+Y1scFIU/0o/3sgeLO12E2k7UXKYumgFoAYdg8ACIAYpoBh6cAhAGKYAoalA4cAiGEKGJYOHAIghilgWDpwCIAYpoBh6cAhAGKYAoalA4cAiGEKGJYOHAIghilgWDpwCIAYpoBh6ZQ4JB6PKzviYthnNy4d9h+1M5mMlVckkUjsG5dhiBMCEMPg/wuOfrZZ/RSywQAAAABJRU5ErkJggg==";
var IMG_PLAYBTN = "data:image/png;base64,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AAAAAACAlFAAAwAAAAAAAKSEAhgAAAAAAAAgJRTAAAAAAAAAACmhAAYAAAAAAABICQUwAAAAAAAAQEoogAEAAAAAAABSQgEMAAAAAAAAkBIKYAAAAAAAAICUUAADAAAAAAAApIQCGAAAAAAAACAlFMAAAAAAAAAAKaEABgAAAAAAAEgJBTAAAAAAAABASiiAAQAAAAAAAFJCAQwAAAAAAACQEgpgAAAAAAAAgJRQAAMAAAAAAACkhAIYAAAAAAAAICUUwAAAAAAAAAApoQAGAAAAAAAASAkFMAAAAAAAAEBKKIABAAAAAAAAUkIBDAAAAAAAAJASCmAAAAAAAACAlFAAAwAAAAAAAKSEAhgAAAAAAAAgJRTAAAAAAAAAACmhAAYAAAAAAABICQUwAAAAAAAAQEoogAEAAAAAAABSQgEMAAAAAAAAkBIKYAAAAAAAAICUUAADAAAAAAAApIQCGAAAAAAAACAlFMAAAAAAAAAAKaEABgAAAAAAAEgJBTAAAAAAAABASiiAAQAAAAAAAFJCAQwAAAAAAACQEgpgAAAAAAAAgJRQAAMAAAAAAACkhAIYAAAAAAAAICUUwAAAAAAAAAApoQAGAAAAAAAASAkFMAAAAAAAAEBKKIABAAAAAAAAUkIBDAAAAAAAAJASCmAAAAAAAACAlFAAAwAAAAAAAKSEAhgAAAAAAAAgJRTAAAAAAAAAACmhAAYAAAAAAABICQUwAAAAAAAAQEoogAEAAAAAAABSQgEMAAAAAAAAkBIKYAAAAAAAAICUUAADAAAAAAAApIQCGAAAAAAAACAlFMAAAAAAAAAAKaEABgAAAAAAAEgJBTAAAAAAAABASiiAAQAAAAAAAFJCAQwAAAAAAACQEgpgAAAAAAAAgJRQAAMAAAAAAACkhAIYAAAAAAAAICUUwAAAAAAAAAApoQAGAAAAAAAASAkFMAAAAAAAAEBKKIABAAAAAAAAUkIBDAAAAAAAAJASCmAAAAAAAACAlFAAAwAAAAAAAKSEAhgAAAAAAAAgJRTAAAAAAAAAACmhAAYAAAAAAABICQUwAAAAAAAAQEoogAEAAAAAAABSQgEMAAAAAAAAkBIKYAAAAAAAAICUUAADAAAAAAAApIQCGAAAAAAAACAlFMAAAAAAAAAAKaEABgAAAAAAAEgJBTAAAAAAAABASiiAAQAAAAAAAFJCAQwAAAAAAACQEgpgAAAAAAAAgJRQAAMAAAAAAACkhAIYAAAAAAAAICUUwAAAAAAAAAApoQAGAAAAAAAASAkFMAAAAAAAAEBKKIABAAAAAAAAUkIBDAAAAAAAAJASCmAAAAAAAACAlFAAAwAAAAAAAKSEAhgAAAAAAAAgJRTAAAAAAAAAACmhAAYAAAAAAABICQUwAAAAAAAAQEoogAEAAAAAAABSQgEMAAAAAAAAkBIKYAAAAAAAAICUUAADAAAAAAAApIQCGAAAAAAAACAlFMAAAAAAAAAAKaEABgAAAAAAAEgJBTAAAAAAAABASiiAAQAAAAAAAFJCAQwAAAAAAACQEgpgAAAAAAAAgJRQAAMAAAAAAACkhAIYAAAAAAAAICUUwAAAAAAAAAApoQAGAAAAAAAASAkFMAAAAAAAAEBKKIABAAAAAAAAUkIBDAAAAAAAAJASCmAAAAAAAACAlFAAAwAAAAAAAKSEAhgAAAAAAAAgJRTAAAAAAAAAACmhAAYAAAAAAABICQUwAAAAAAAAQEoogAEAAAAAAABSQgEMAAAAAAAAkBIKYAAAAAAAAICUUAADAAAAAAAApIQCGAAAAAAAACAlFMAAAAAAAAAAKaEABgAAAAAAAEgJBTAAAAAAAABASiiAAQAAAAAAAFJCAQwAAAAAAACQEgpgAAAAAAAAgJRQAAMAAAAAAACkhAIYAAAAAAAAICUUwAAAAAAAAAApoQAGAAAAAAAASAkFMAAAAAAAAEBKKIABAAAAAAAAUkIBDAAAAAAAAJASCmAAAAAAAACAlFAAAwAAAAAAAKSEAhgAAAAAAAAgJRTAAAAAAAAAACmhAAYAAAAAAABICQUwAAAAAAAAQEoogAEAAAAAAABSQgEMAAAAAAAAkBIKYAAAAAAAAICUUAADAAAAAAAApIQCGAAAAAAAACAlFMAAAAAAAAAAKaEABgAAAAAAAEgJBTAAAAAAAABASiiAAQAAAAAAAFJCAQwAAAAAAACQEgpgAAAAAAAAgJRQAAMAAAAAAACkhAIYAAAAAAAAICUUwAAAAAAAAAApoQAGAAAAAAAASAkFMAAAAAAAAEBKKIABAAAAAAAAUkIBDAAAAAAAAJASCmAAAAAAAACAlFAAAwAAAAAAAKSEAhgAAAAAAAAgJRTAAAAAAAAAACmhAAYAAAAAAABICQUwAAAAAAAAQEoogAEAAAAAAABSQgEMAAAAAAAAkBIKYAAAAAAAAICUUAADAAAAAAAApIQCGAAAAAAAACAlFMAAAAAAAAAAKaEABgAAAAAAAEgJBTAAAAAAAABASiiAAQAAAAAAAFJCAQwAAAAAAACQEgpgAAAAAAAAgJRQAAMAAAAAAACkhAIYAAAAAAAAICUUwAAAAAAAAAApoQAGAAAAAAAASAkFMAAAAAAAAEBKKIABAAAAAAAAUkIBDAAAAAAAAJASCmAAAAAAAACAlFAAAwAAAAAAAKSEAhgAAAAAAAAgJRTAAAAAAAAAACmhAAYAAAAAAABICQUwAAAAAAAAQEoogAEAAAAAAABSQgEMAAAAAAAAkBIKYAAAAAAAAICUUAADAAAAAAAApIQCGAAAAAAAACAlFMAAAAAAAAAAKaEABgAAAAAAAEgJBTAAAAAAAABASiiAAQAAAAAAAFJCAQwAAAAAAACQEgpgAAAAAAAAgJRQAAMAAAAAAACkhAIYAAAAAAAAICUUwAAAAAAAAAApoQAGAAAAAAAASAkFMAAAAAAAAEBKKIABAAAAAAAAUkIBDAAAAAAAAJASCmAAAAAAAACAlFAAAwAAAAAAAKREkRUAAACwrUpLSwuGDRvWfMCAAS26du3avKysrLiioqKkZcuWzZs1a1bcvHnz0tLS0rJsNtusuLi4ebNmzUoLCgo+8/eijY2N9Zs3b66pra2tqqur21xTU1NdVVVVs2nTptqNGzdWbdiwoeYvf/nL5hUrVlQtWLBgw6xZs6pqamoaJQYAAEDaKYABAACIiIghQ4aUHnTQQW379u3bql27dq3at2/fpkWLFq2bN29eWVpa2qpZs2bNCwsLm2ez2fLCwsLyoqKi8sLCwtKknK+hoaG6vr6+qqGh4S91dXV/aWhoqNq8eXNVTU3NuqqqqvUbNmxYu2rVqjWrV69e99Zbb6177rnnPpgzZ06NTwYAAABJogAGAADIA8OGDWt+xBFHdBwwYECnLl26dGjdunXHFi1adCgtLe1YUlLSvlmzZq0KCgqK07yDwsLCssLCwrKIaPdp/zuNjY21mzdvXrdp06ZVNTU172/YsGHl2rVr31+2bNnKBQsWrHjyySffnzVrVpVPGAAAAE1Fpuexsd9HfaF+ZcSal0ptCAAAIAE6deqUPf744zvtueeeXbp3796lbdu2XSorKzuXlpZ2KS0t7VBYWFhhSztGQ0PDxpqampU1NTXL169fv+yDDz5Y9s477yybPXv2sj/96U8rVqxYUWdLAAAAbE9t9q6Jog4f/TUFMAAAQEJks9nMt7/97Y4jRozo1bdv397t2rXrXl5e3rWsrKxzcXFx+4gosKUmp7G2tnZVTU3Nso0bNy5btWrV0tdff/2tJ598cvG999672noAAADYFgpgAACAhPne977X6a9Fb/v27Xu1bNmyV1lZWa8kvXOXLauvr9/wl7/8ZdG6desWL1u2bNHChQsX/fGPf1w8derUjbYDAADAliiAAQAAmqhsNps59dRTuxx66KH9+/Tp87n27dv3Ly8v719UVOSRzXlq06ZNKzZu3Pj6+++//8abb775xqOPPvrG3XffvcpmAAAA+CsFMAAAQBNx6qmndvniF784qHfv3v3btWv3uYqKis8VFhaW2wxbUl9fv37Dhg1vfPDBB68vXrz4jccee2z+jTfeuNxmAAAA8pMCGAAAYBc45phjWn/rW9/aq3///kPatGnTv6Kiop9HOLO9NDQ0VG/cuPGtNWvWLFy4cOGcO+6445WHHnporc0AAACknwIYAABgJzjjjDO6f+lLX9qrV69eg1u3bj2orKysR0RkbIadJFddXb103bp18xcvXjz30UcffeXqq69+x1oAAADSRwEMAACwnZWWlhb86le/2u3QQw8d1r17931btmw5qLCwsMxmaEoaGhqqP/zww/nvvPPOzGeeeWbW2LFj36ipqWm0GQAAgGRTAAMAAGwHP/7xj7t+9atf3bdXr15D27Ztu1c2m21jKyRJXV3dmg8++OCVRYsWvfznP/95xh/+8IdltgIAAJA8CmAAAIBtcOKJJ7Y75ZRTDujXr9+w1q1bD81ms61shTSpq6tbt3bt2pfffPPNWbfccsvUe++9d7WtAAAANH0KYAAAgE+hoqKi4IILLhg0YsSI/bp27bpfy5YtB2YymUKbIR/kcrmGDz/8cP6777474/nnn59x4YUXvrZx40aPiwYAAGiCFMAAAAAf4/jjj2/7/e9//8D+/fsf2Lp1630KCgpKbAUiGhsbN61fv37eW2+9NeWGG2545u67715lKwAAAE2DAhgAAOB/ZLPZzAUXXPC5I4888sDu3bsfWFFRsVtEFNgMbFl1dfWSd999d8qsWbNmnnvuuS+vW7euwVYAAAB2DQUwAACQ10pLSwsuvfTSQYcccsjBXbt2HVFWVtbDVmDb1dbWrnr//fdfmDp16uRf/vKXL65evbreVgAAAHYeBTAAAJB3Bg0aVHrBBRd8fs899zywQ4cOBxQVFbWwFdj+Ghsba9euXTtrzpw5T59//vmTX3755WpbAQAA2LEUwAAAQF4YNmxY8/POO+/gIUOGHOZ9vrDz/W0ZfNFFFz07a9asKlsBAADY/hTAAABAarVq1arwyiuv3HfEiBEjO3TocFBhYWGZrcCu19DQUP3+++8/O2XKlIk/+clPZm7cuLHRVgAAALYPBTAAAJAqrVq1Kvztb3+7/3777Xd4x44dRxQWFpbbCjRdDQ0NG99///0pM2bMeOqHP/zhC8pgAACAz0YBDAAApMJZZ53V45vf/OaRvXr1GllaWtrVRiB5ampq3l28ePHEO++8c9LVV1/9jo0AAABsPQUwAACQWMOHDy+/6KKLvjB48OCjW7RoMdBGID0+/PDDV+fNmzfhvPPOe3L69Ol/sREAAIBPRwEMAAAkSqtWrQpvuOGGQ/bbb79/atOmzX6ZTCZrK5BeuVyubs2aNTNmzJjx2JgxYyavW7euwVYAAAA+ngIYAABIhB//+Mddv/e9732lZ8+e/1RcXNzWRiD/1NbWfvD2228/dssttzz029/+9l0bAQAA+L8UwAAAQJNVUVFRcO21137+4IMPPrZ169b7ZTKZAlsBIqJxzZo1M59//vnxp5122hR3BQMAAPx/CmAAAKDJOeWUUzqefvrpx/bu3ftL2Wy2jY0AH6e+vn7j0qVLH/vd7373x+uvv36ZjQAAAPlOAQwAADQJ2Ww2c+uttx5wyCGHnNC6deu9I8LdvsDWaFy7du1L06ZN+/OPfvSjZ1evXl1vJQAAQD5SAAMAALtU//79S6655pp/2nPPPY8tLy/vayPAZ1VTU7NswYIF488999wHp06dutFGAACAfKIABgAAdomf//znPU855ZQTu3btemRhYWGZjQDbW2NjY92KFSuevOWWW+689NJLF9kIAACQDxTAAADATuMxz8Cusn79+rlPP/30f5188slT6+rqcjYCAACklQIYAADY4fr27Vv8hz/84a+Pee5nI8CuUlNT8+68efPu/8EPfvDgwoULN9kIAACQNgpgAABghxkyZEjpNddc89XBgwefWFxc3MFGgKaitrZ21dy5c+/5yU9+8uc5c+bU2AgAAJAWWyqAPYoNAADYJqNHj+4wb968n06ZMuXRYcOGnaH8BZqa4uLi9sOGDTtjypQpj86bN++nJ510UntbAQAA0s4dwAAAwFY599xze33/+9//dufOnY/IZDJZGwGSIpfL1S1fvvzJG2644fbLLrvsbRsBAACSyiOgAQCAz+y8887r+53vfOfbHTt2PDyTyRTaCJBUuVyuYcWKFU/cdNNN//XrX/96sY0AAABJowAGAAC22WWXXTboG9/4xg9at249zDaAtFm7du2su++++9pzzjnnNdsAAACSQgEMAABsNcUvkE8UwQAAQJIogAEAgE9N8Qvks7Vr18665557rvv5z38+3zYAAICmaksFcGHlwOj6UV9orIqoWZG1PQAAyBO/+MUvet9xxx3nHHrooT8pLS3tYiNAPiotLe2y7777HvP973+/X1lZ2ZIpU6assxUAAKCpKetcHwXlH/01BTAAAOS5M844o/u99957zpe//OWflZeX94qIjK0AeS5TXl7e8+CDDx71/e9/v3dEvDVjxowPrQUAAGgqFMAAAMD/ceKJJ7a77777fjJq1Kh/KS8v7xOKX4B/lCkvL+99+OGHj/rWt77VfvXq1Qvnz59fbS0AAMCutqUC2DuAAQAgzwwdOrTs+uuvP6l///4nFRYWltkI20NjY2Ns2rQpqquro6amJurr62PTpk2xefPmqK+vj+rq6qivr4/NmzfHpk2boqGhYZv/fxUWFkZJSUk0a9YsioqKoqysLIqKiqJZs2ZRUlISRUVFUVpa+r9/FRQUCIjtoqGhoeq11167a8yYMffMmTOnxkYAAIBdZUvvAFYAAwBAnujUqVP2nnvuGbXXXnudnM1mK22Ej9PQ0BAbN26MDRs2/J+/Nm7cGBs3boyamprYtGlTbNq0KWpqaqK2trbJnqe4uDhKSkqitLT0f/9eUVERFRUV0aJFi//zV0VFRRQWFvog8LHq6urWvvjii7eceOKJf169enW9jQAAADubAhgAAPLcXXfdddAXv/jF00tLS7vZRn7L5XKxYcOGWLt2baxbty7Wrl37d3+tW7cuNmzYkPd7atGiRbRu3TpatWoVrVu3jjZt2vzvf27dunW0aNHCh4morq5e+sgjj1zzne98Z6ptAAAAO5MCGAAA8tTVV189+MQTTzyzoqJioG3kj8bGxli5cmUsX748Pvjgg1i9evX//n3t2rXR2NhoSZ9RYWFhtGrVKtq1axdt27b937937tw5OnTo4LHTeWbDhg3z77333qvOPPPMebYBAADsDApgAADIM1/72tfaXHrppad27979qIjQRKVUQ0NDrFq1KlasWBHvv//+//595cqVTfqRzGlXXFwcHTp0iI4dO0bnzp2jY8eO0alTp2jXrp1HS6dYLpdrfOeddx76+c9/fv2ECRPW2QgAALAjKYABACBP9OrVq9ldd931jT322OM7hYWFZTaSHh9++GG88847sXTp0njvvfdixYoVsXr16mhoaLCchCgsLIz27dtHp06dolu3btG9e/fo3r27x0mnTENDQ9W8efNu++Y3v/nHJUuWbLYRAABgR1AAAwBAHrjrrrtG/NM//dOZJSUlXWwj2davXx9Lly6Nd955539L3w8//NBiUqqysvJ/y+C//tWqVSuLSbiamppljz322G9Gjx49xTYAAIDtTQEMAAAp9qtf/arPD3/4w5+1atVqL9tIno0bN8aSJUvirbfeikWLFsV7770XmzZtspg8V1JSEl27do0+ffpE3759o3fv3lFeXm4xCbRu3bqXr7322ivGjh27yDYAAIDtRQEMAAApNGjQoNI77rjju7vttttJBQUFWRtJhtWrV8ebb74ZixcvjiVLlsTy5cujsbHRYtiigoKC6Ny5c/Tu3Tt69+4d/fr1i7Zt21pMQjQ2Nta98cYbd33rW9+6ff78+TU2AgAAfFYKYAAASJHS0tKCBx988Jj99tvvn7PZbBsbaboaGhri7bffjrfeeisWLFgQS5YscXcv201FRUX06tUr+vbtG3379o2ePXtGYWGhxTRhdXV1a2bMmHHjV77ylYdqamr85gcAALDNFMAAAJASp59+erdf/vKX51ZWVu5jG03T6tWr47XXXouFCxfGm2++GRs3brQUdooWLVpE3759Y8CAATFw4EB3CDdh69evf/E//uM//vPqq69+xzYAAIBtoQAGAICEGzRoUOm99977w969ex+byWTc4teErF+/PubNmxcLFiyIN954Q+FLk9GiRYvo169fDBgwIPbYY4+orKy0lCYkl8s1LF68eNyJJ554rcdCAwAAW0sBDAAACXbNNdcMOemkk35RVlbWyzZ2vVwuF++++27MnTs3XnvttViyZIl3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B7lcrm7y5Mm//vKXv/yIbQAAwK63pXcAK4ABAMg7paWlBTNnzjyzT58+x9vG39uwYUOMGzcuZsyY4VHPQF7KZDKx3377xde//vWoqKiwkH+waNGiP+27775X1dTUeCwEAADsQgpgAAD4H926dctOnjz5V506dRppG/9fLpeLqVOnxp///OfYuHGjhQB5r6KiIkaNGhX777+/x0L/g+XLlz9+6KGHXvLuu+/W2QYAAOwaWyqAvQMYAIC8MXz48PInnnjiynbt2o2wjf/vnXfeiWuvvTaee+652Lx5s4UARMTmzZtjzpw58dprr0XPnj2jRYsWlvI/Kioq+n7rW98aMnXq1Ofee+89f3AAAMAusKV3ACuAAQDIC9/+9rc73n777X9o0aLFANv4b1VVVXHXXXfFvffeG+vXr7cQgI+wbt26eP7552P9+vWx2267RVFRkaVERElJSefjjjvuoA8++GDKK6+88hcbAQCAnUsBDABAXjv//PP7XXzxxX8oKSnpbBv/bfr06XHttdfGokWLLAPgU3jnnXdi2rRp0bp16+jc2R8nERHZbLbyC1/4whElJSUvTp48eY2NAADAzqMABgAgb/3ud7/b60c/+tFVRUVFrWwjYs2aNXHzzTfHpEmTora21kIAtkJtbW289NJL8c4770Tfvn2jtLQ073dSWFhYNnz48C/26dNn4UMPPbTMpwQAAHYOBTAAAHnp1ltv3f+b3/zmfxYWFjbP913kcrl4/vnn4/rrr4/ly5f7cAB8BitXroxp06ZFRUVFdOvWLTKZTF7vo6CgIDto0KBDBw0atOiBBx54xycEAAB2vC0VwJmex8Z+H/WF+pURa17ym6wAACTTww8//KXDDjvsXzKZTN6/rPGDDz6I22+/Pd544w0fDIDtbMCAAfGtb30r2rRpk/e7yOVyjVOmTPn1yJEjH/LJAACAHavN3jVR1OGjv6YABgAgdV555ZXTPve5z30r3/fQ0NAQjz32WDz++ONRV1fngwGwg2Sz2Tj66KPjC1/4QhQUFOT9Pl5//fU79tprr9/7ZAAAwI6jAAYAIC9ks9nMyy+/fFafPn2Oz/ddvPvuu3HbbbfFe++954MBsJN069YtvvOd70S3bt3yfhdLliy5f5999rmypqam0ScDAAC2PwUwAACpV1paWjBr1qyzevfufVw+7yGXy8WTTz4ZDz74oLt+AXaBbDYbxxxzTBxxxBF5fzfw0qVLHxg6dOjlSmAAANj+FMAAAKRar169mk2ePHlsu3btDsrnPaxcuTJuueWWePvtt30oAHaxnj17ximnnBIdOnTI6z2sXr16yiGHHPIvS5Ys2exTAQAA28+WCuDCyoHR9aO+0FgVUbMia3sAADRpQ4cOLXvqqacub9Omzf75uoNcLhfPPPNMXH/99bF27VofCoAmYP369TFlypQoKSmJnj17RiaTycs9NG/evPtJJ500ZPLkyc+sWLHCoykAAGA7KetcHwXlH/01BTAAAIk1ZMiQ0kceeeSKVq1a7Z2vO6iuro7bb789nnjiiWhs9IRNgKaksbEx5s+fH++//34MGDAgstn8/DlLaWlpp6997WuDn3rqqadXrlxZ75MBAACfnQIYAIDUOfTQQ1s8+OCDv2/ZsuUe+bqDOXPmxNVXX+2RzwBN3PLly+OFF16Ijh075u0joUtLSzudcMIJ+7/00ktPv/3227U+FQAA8NkogAEASJVhw4Y1v++++37TsmXLQfl4/vr6+hg/fnz88Y9/jNpaP0MHSILNmzfHiy++GJs3b47ddtstCgoK8m4HxcXFbY866qg9n3vuuaeXL1/ucdAAAPAZKIABAEiNI488snLcuHG/b9GixcB8PP97770XV111VcyZM8eHASCBFi1aFC+//HL069cvWrRokXfnLykp6XDcccftP2fOnGcWLVq0yScCAAC2jQIYAIBUOPLIIyvvvPPO35aXl++Wj+d/+umn48Ybb4wPP/zQhwEgwf7yl7/ECy+8ECUlJdGrV6+8O3+zZs3aHHXUUfspgQEAYNspgAEASLxjjz227W233faH5s2b98m3s1dVVcXNN98cTz31VDQ2NvowAKRAY2NjzJ8/P5YtWxYDBgyIZs2a5dX5mzVr1uaYY4458M0333xm4cKFNT4RAACwdRTAAAAk2qGHHtritttuuzofy9+33347rrnmmli8eLEPAkAKvf/++/HKK69Enz59orKyMq/Ons1mK4888sh9Zs6c+dTSpUs3+zQAAMCnpwAGACCxjjjiiJb33nvvteXl5f3y6dy5XC4mTZoUN998c1RVVfkgAKRYVVVVTJ06NbLZbPTp0ycymUzenL24uLjtV7/61c+/8sorTy1evLjWpwEAAD4dBTAAAIl06KGHtrj33nt/l2/lb3V1ddx0000xefLkyOVyPggAeSCXy8WCBQvi3Xffjd133z2y2fz5mUyzZs1aH3300fvNmDHjSXcCAwDAp6MABgAgcYYOHVo2fvz4qysqKgbk07mXLVsWV111lUc+A+SplStXxiuvvBKf+9znoqKiIm/O3axZszZHH3300GeeeebJFStW1PkkAADAlimAAQBIlCFDhpQ++uij17Rs2XL3fDr31KlT49prr42NGzf6EADksaqqqpg+fXq0bds2unTpkjfnLikpaT9q1KihTz755JMrV66s90kAAICPt6UCuMB6AABoSjp16pSdMGHCv1dWVu6RL2dubGyMcePGxR133BF1dW56AiCitrY2br755hg/fnw0NjbmzbkrKyv3mDBhwr9369bNXQkAALCNFMAAADQZrVq1Kpw+ffolbdq02T9fzlxdXR2/+93vYtKkSd73C8DfyeVy8fjjj8fvf//7qK6uzptzt2nTZv8pU6Zc0qpVq0KfAgAA2HoKYAAAmoSKioqC2bNnX9KuXbuD8uXMS5cujYsuuijmz5/vAwDAx3r11VfjoosuiqVLl+bNmdu1a3fQ7Nmz/72iosLPrgAAYCu5iAYAoEmYOXPmz9q1a3dIvpz35ZdfjiuuuCLWrVsnfAA+0bp16+KKK66Il19+OW/O3K5du4Nnzpz5M+kDAMDWUQADALDLvfjii2N69OgxKh/Omsvl4oEHHogbbrghamtrhQ/Ap1ZbWxs33HBDPPDAA3nz2oAePXqMevHFF8dIHwAAPj0FMAAAu9SkSZO+NnDgwFPy4ax1dXVx8803x8SJE73vF4BtksvlYuLEiXHLLbdEXV1dXpx54MCBJ0+aNOlr0gcAgE9HAQwAwC7z6KOPHnXggQeekw9nXbduXfz617+OWbNmCR6Az2zmzJnx61//Ol9eJZA58MADz3n00UePkjwAAHyywsqB0fWjvtBYFVGzImtDAADsEDfeeOO+Rx999EWZTKYw7Wddvnx5XHXVVbFy5UrBA7DdbNiwIWbPnh0DBw6MioqKtB8307179/179uz56sMPP7xc+gAA5LuyzvVRUP7RX1MAAwCw011xxRV7fPe7372qoKCgWdrPOmfOnPjtb38bGzduFDwA2111dXVMmzYtOnfuHB07dkz1WTOZTOHuu+9+eJs2bV6aNGnSKukDAJDPFMAAADQZZ5xxRvef/exnvy0sLCxP+1knTJgQd999d9TX1wsegB2moaEhXnrppchms9G3b99UnzWTyRTttddeB/3lL395dubMmRukDwBAvlIAAwDQJBx00EEVf/jDH64pLi7ulOZz5nK5eOCBB+Kxxx4TOgA77c+eBQsWRF1dXfTv3z8ymUxqz1pQUFBywAEHDJs+ffqkpUuXbpY+AAD5aEsFcIH1AACwMwwaNKj0vvvuu7qsrKxXms9ZV1cX1113XUyaNEnoAOx0EydOjOuvvz7q6upSfc6ysrJef/rTn67u379/idQBAODvKYABANjhKioqCh577LGLKyoqBqb5nNXV1XHNNdfE7NmzhQ7ALvPKK6/ElVdeGVVVVak+Z4sWLQZOnDhxbEVFhZ9vAQDA33CBDADADjdz5syftW3b9sA0n3HdunVx2WWXxRtvvCFwAHa5xYsXx2WXXRZr165N9TnbtWt34MyZM38mcQAA+P8UwAAA7FBPPvnkqB49eoxK8xlXrVoVV1xxRSxfvlzgADQZK1asiCuuuCJWrlyZ6nP26NFj1KRJk0ZJHAAA/lth5cDo+lFfaKyKqFmRtSEAALbZjTfeuO+XvvSlCzOZTGp/8fDdd9+NK6+8MtatWydwAJqc6urqmDVrVvTv3z8qKytTe85u3boN79mz57yHH37Yb2MBAJAXyjrXR0H5R39NAQwAwA5x3nnn9T311FOvLigoKE7rGV977bW45pprorq6WuAANFmbN2+OGTNmRI8ePaJ9+/apPGMmkykYNGjQIYWFhVOee+45v5UFAEDqKYABANipjjrqqFb/8R//8YdmzZq1SusZX3755bj++uujrq5O4AA0eQ0NDfHSSy9Fp06dolOnTqk8Y0FBQXbYsGGfnz9//qQ33nhjk9QBAEizLRXA3gEMAMB21a1bt+wNN9zwnyUlJR3TesYpU6bEjTfeGPX19QIHIDHq6+vjxhtvjKlTp6b2jCUlJZ1uuOGG/+jWrZu7GgAAyFsKYAAAtqunn376XyorK/dI6/kmTZoUd955ZzQ2NgobgMRpbGyMO+64I5588snUnrGysnLw008//UtpAwCQrxTAAABsN88///w3unTp8k9pPd/EiRNj3LhxkcvlhA1AYuVyubj//vtTXQJ36dLlS88+++yJ0gYAIB95BzAAANvFTTfdNPzII488L5PJZNJ4vsceeyzGjx8vaABS47XXXotmzZpF3759U3m+zp0779urV695Dz/88DJpAwCQNlt6B7ACGACAz+wXv/hF7x/+8IdXFxQUNEvj+R544IF45JFHBA1A6ixYsCDq6upiwIABqTtbJpPJDBo06ODGxsbnpk6dul7aAACkiQIYAIAd5oADDqj43e9+99tmzZq1TeP5xo0bF5MmTRI0AKm1aNGi2Lx5cwwcODB1ZysoKMjut99+w5577rnH33vvvc3SBgAgLbZUAHsHMAAA2yybzWbuvPPOfyktLe2exvNNmDBB+QtAXpg0aVI89NBDqTxbaWlpj3vuuedfstlsRtIAAOQDBTAAANvs+eef/06HDh0OTePZHn744Xj44YeFDEDeeOSRR+LPf/5zKs/WoUOHw5599tlvSxkAgHygAAYAYJvcd999hw8ePPjUNJ7t/vvvjwkTJggZgLzz2GOPxX333ZfKs+25554/+NOf/nSYlAEASDvvAAYAYKudccYZ3ceMGXN5QUFBcdrONnHixHjkkUeEDEDeWrx4cWSz2ejbt2/ajpbp06fPvn/5y18mz5w5c4OkAQBIsi29A1gBDADAVhk2bFjzG2+88Q/NmjVrl7azPfroo6l99CUAbI2FCxdGUVFR9OvXL1XnKigoKD7wwAP3e/LJJx9dsWJFnaQBAEiqLRXAHgENAMBWuffee39ZWlraPW3nevzxx+PBBx8UMAD8jz//+c8xceLE1J2rtLS0x3333fdLCQMAkFYKYAAAPrVJkyaN6tSp0xEpPFeMHz9ewADwD8aPHx+TJ09O3bk6der0hUmTJn1VwgAApJFHQAMA8Kmcd955fU888cR/z2QyRWk618yZM+Puu+8WMAB8jNdeey06duwYnTt3TtW5unbtuk9BQcHzzz333DopAwCQNN4BDADAZ3LEEUe0vOKKK67NZrOVaTrXyy+/HDfffHPkcjkhA8DHyOVyMXv27OjSpUt06tQpNefKZDJF++yzz/CpU6c+9u67726WNAAASeIdwAAAbLNsNpu55ZZb/q2kpKRjms61YMGCuPnmm6OxsVHIAPAJGhsb4+abb44333wzVecqLS3tcvfdd5+fzWYzUgYAIC0UwAAAbNGkSZO+3rZt2wPTdKZly5bFDTfcEPX19QIGgE+prq4urr322li+fHmqztWuXbsDH3/88VESBgAgLTwCGgCAj3XZZZcN+upXvzo2k8mk5hcH33///bjyyiujqqpKwACwlerq6uLll1+OIUOGRHl5eWrO1aVLl31LS0unPvPMM2ukDABAEngENAAAW61///4lJ5988q8ymUxRWs60YcOG+P3vfx8bN24UMABso40bN8bvfve7VP15WlBQkP3hD394ft++fYslDABA4q9vrQAAgI/y4IMPnl1WVtYrLeeprq6O3/zmN7Fq1SrhAsBntGrVqrjyyiujuro6NWcqKyvr8/DDD58lXQAAkk4BDADA/zF+/Pgju3XrdnRazlNfX5/KdxYCwK60fPnyuO6666K+vj41Z+rRo8dXx40bd4R0AQBIMgUwAAB/53vf+16nI4444py0nCeXy8Vtt90Wb7zxhnABYDt7/fXX47bbbotcLpeaMx155JHnfvvb3+4oXQAAkkoBDADA/6qoqCi4+OKLLywsLCxPy5nGjx8fs2bNEi4A7CCzZs2Khx56KDXnKSwsrPj1r399QUVFhZ+bAQCQSC5kAQD4XxMnThxdWVk5OC3nef7552PixImCBYAd7LHHHosXXnghNeeprKzc89FHHz1RsgAAJFFh5cDo+lFfaKyKqFmRtSEAgDxxwQUX7DZq1KgLM5lMYRrO8+qrr8Ytt9ySqkdSAkBT/7O3d+/e0a5du1Scp2PHjkNzudxzU6ZMWSddAACamrLO9VHwMc/wcwcwAADRt2/f4h//+McXZzKZVPwG4HvvvRc33HBDNDY2ChcAdpKGhoa47rrrYtmyZak4T0FBQfbss88e27dv32LpAgCQqGtZKwAAYPz48T8qKyvrkYazbNiwIX7/+99HbW2tYAFgJ9u0aVP8/ve/j40bN6biPGVlZb3GjRs3RrIAACSJAhgAIM/ddNNNw/v06XN8Gs5SX18f1157baxdu1awALCLrFmzJq699tqor69PxXn69ev3jd///vdDJQsAQFIogAEA8thBBx1Uceyxx/5rRGTScJ477rgjFi9eLFgA2MUWLVoUd955Z1qOU/CNb3zj34YNG9ZcsgAAJOIC1goAAPLXzTfffFZxcXG7NJxl4sSJMX36dKECQBMxbdq0mDRpUirOUlJS0unOO+88Q6oAACSBAhgAIE/913/914FdunT5UhrO8tprr8Wf//xnoQJAEzN+/PhYsGBBKs7SrVu3o2+66abhUgUAoKlTAAMA5KEvfelLlV/5yld+lYazrFixIq6//vpobGwULAA0MY2NjXHdddfFihUr0nCczHHHHfergw46qEKyAAA0ZQpgAIA8dPXVV5+ezWYrk36OmpqauPbaa2PTpk1CBYAmatOmTXHttddGTU1N4s+SzWbb3njjjT+RKgAATZkCGAAgz9x6663Du3Tp8uWknyOXy8Utt9wSK1euFCoANHErV66MW2+9NXK5XOLP4lHQAAA0dQpgAIA8MnTo0LKvfvWrv0jDWSZMmBBz584VKgAkxJw5c+Kxxx5LxVlGjRr1i6FDh5ZJFQCApkgBDACQR+64444fFRcXd0z6OV5++eV45JFHBAoACfPQQw+l4he4SkpKOt5xxx0/lCgAAE2RAhgAIE9cfvnlu/fs2XNU0s/xwQcfxB133JGKR0gCQL7J5XJx2223xZo1axJ/lp49ex57+eWX7y5VAACaGgUwAEAe6NatW/a73/3uv2YymURf/9XX18cNN9wQ1dXVQgWAhKqqqoobb7wx6uvrE32OTCZT8N3vfvdX3bp1y0oVAICmRAEMAJAHxo8ff0pZWVmvpJ/jnnvuiaVLlwoUABJuyZIlcd999yX+HGVlZT3Hjx9/ikQBAGhKFMAAACn385//vOeAAQNGJ/0c06dPjylTpggUAFJi8uTJMWPGjMSfY8CAAaN//vOf95QoAABNhQIYACDFstls5qyzzjo3k8kk+tGEK1asiLvvvlugAJAyd911V6xYsSLRZ8hkMtmzzjrr3Gw2m5EoAABNgQIYACDFxo0b98XKysq9knyG2trauOGGG6K2tlagAJAyf/1zfvPmzYk+R2Vl5V7jxo0bKVEAAJoCBTAAQEoNHz68/OCDDz4t6ee4//77Y/ny5QIFgJRavnx5jBs3LvHnGDFixI+HDRvWXKIAAOxqCmAAgJS69dZbT8tms22TfIYZM2bEc889J0wASLnJkyfHzJkzE32G4uLitrfffvtp0gQAYFdTAAMApNBVV121R48ePb6S5DOsXLky7rrrLmECQJ64++6744MPPkj0GXr27PnVK664Yg9pAgCwKymAAQBSprS0tOAb3/jGT5N8rdfY2Bi333679/4CQB6pqamJ2267LRobG5N8jIJvfvObZ5aWlvqZGwAAu+6i1AoAANJlwoQJX6uoqBiQ5DOMHz8+Fi1aJEwAyDNvvvlmPPjgg4k+Q4sWLQY9+OCDx0gTAIBdRQEMAJAiRx55ZOWwYcN+kOQzzJ07N5544glhAkCemjhxYixYsCDRZxg+fPiPjjjiiJbSBABgV1AAAwCkyBVXXHFyUVFRRVLnr6qqijvvvDNyuZwwASBP5XK5uP3226O6ujqxZygqKmrxm9/85mRpAgCwKyiAAQBS4vzzz+/Xu3fv45J8httvvz0+/PBDYQJAnlu3bl3cfvvtiT5D7969jz///PP7SRMAgJ1NAQwAkALZbDZz6qmn/jyTyST2+m769OkxZ84cYQIAERExe/bsmDFjRmLnz2QyBaeeeurPs9lsRpoAAOxMCmAAgBT44x//eERlZeXgpM6/du3auPfeewUJAPyde+65J9atW5fY+SsrKwf/6U9/+oIkAQDYmRTAAAAJ17dv3+JDDjnkR0k+w9133x01NTXCBAD+Tk1NTdx9992JPsPBBx/8o759+xZLEwCAnUUBDACQcHfdddc3S0pKOiV1/smTJ8e8efMECQB8pLlz58azzz6b2PlLSko63nPPPd+SJAAAO4sCGAAgwb70pS9VDhw48KSkzr9mzZoYP368IAGALXrggQdizZo1iZ2/f//+Jx111FGtJAkAwM6gAAYASLArrrji1MLCwvIkzp7L5eK2226LTZs2CRIA2KJNmzbFbbfdFrlcLpHzFxYWll1++eU/kCQAADuDAhgAIKF+8Ytf9O7evftXkjr/s88+G2+88YYgAYBP5Y033ojnn38+sfN369bt6F/96ld9JAkAwI6mAAYASKgf/vCHP8pkMom8nvvggw/igQceECIAsFXGjRsX69atS+TsmUym4NRTT/2xFAEA2NEUwAAACXTdddcNa9eu3YFJnD2Xy8Udd9wRtbW1ggQAtsqmTZvizjvvTOz8bdq02f+mm27aT5IAAOxICmAAgIQpLS0t+NrXvnZ6Uud/4YUXYuHChYIEALbJq6++GjNmzEjs/Mccc8zpFRUVfiYHAMAO42ITACBhbr/99oMrKip2S+LsGzZsiHHjxgkRAPhM7r///qiqqkrk7OXl5X3/67/+6wgpAgCwoyiAAQASpKKiouCwww47Nanz33vvvYn9YS0A0HRs2LAh7r///sTOf9BBB/1zq1atCiUJAMCOoAAGAEiQ+++//+iysrKeSZx9zpw58dJLLwkRANguXnjhhViwYEEiZy8tLe32xz/+8StSBABgR1AAAwAkRN++fYv33Xfff07i7LW1tXHvvfcKEQDYru6+++6oq6tL5Oz77bffKf379y+RIgAA25sCGAAgIW6++eZRxcXFbZM4+yOPPBJr164VIgCwXa1atSoee+yxRM6ezWbb3njjjV+TIgAA25sCGAAgAYYOHVq21157fSeJs7/33nvxxBNPCBEA2CEmTpwYK1asSOTsQ4YM+c7QoUPLpAgAwPakAAYASIBrr732xKKiosqkzZ3L5eKee+6JxsZGIQIAO0R9fX3cddddkcvlEjd7UVFR5bXXXnuCFAEA2J4UwAAATdwBBxxQMWDAgG8kcfYZM2bEW2+9JUQAYId6880348UXX0zk7AMGDPjG8OHDy6UIAMD2ogAGAGjirrrqqhOKiooqkjb3pk2b4oEHHhAgALBT3H///VFbW5u4uYuKilpcffXV7gIGAGC7UQADADRhBx10UEX//v0Teffvww8/HB9++KEQAYCdYv369TFhwoREzj5w4MBvHHDAARVSBABge1AAAwA0Yf/5n/95bGFhYfOkzb1q1aqYPHmyAAGAnerpp5+O1atXJ27uwsLC8ssuu2yUBAEA2B4UwAAATdQBBxxQMWjQoNFJnP3uu++O+vp6IQIAO1V9fX3cddddiZx99913/+bQoUPLpAgAwGelAAYAaKIuv/zyYwsLC8uTNvfcuXNjwYIFAgQAdokFCxbE3LlzEzd3UVFRi9/97ndflyAAAJ+VAhgAoAkaOnRo2aBBgxL37t+6urr405/+JEAAYJf605/+FHV1dYmbe/fdd//mkCFDSiUIAMBnoQAGAGiCfvOb33ylqKioZdLmfu655xL53j0AIF1Wr14dzz33XOLmLioqann11VcfLUEAAD4LBTAAQBPTq1evZoMHD/5m0uaurq6ORx55RIAAQJPwyCOPRHV1deLmHjJkyLe6deuWlSAAANtKAQwA0MTcdNNNxxQXF7dN2twTJkyIqqoqAQIATUJVVVUifzmtuLi43a233uouYAAAtpkCGACgCWnVqlXhXnvtdVLS5l61alU8++yzAgQAmpTJkyfHqlWrEjf30KFDR7dq1apQggAAbAsFMABAE3LLLbccXlJS0jlpcz/44INRX18vQACgSamvr48HH3wwcXOXlJR0vummmw6VIAAA20IBDADQRGSz2cwBBxzw7aTNvWjRonjppZcECAA0SS+99FIsXrw4cXOPGDHiO9lsNiNBAAC2lgIYAKCJuOaaa/YuLy/vm7S5H3roocjlcgIEAJqkXC6XyLuAy8vL+1111VV7SRAAgK2lAAYAaCK+8pWvfDdpM8+bNy8WLlwoPACgSVu4cGG8+uqrrg8BAMgLCmAAgCbgsssuG1RZWblPkmbO5XIxfvx44QEAifDAAw8k7qklrVu33veSSy7pLz0AALaGAhgAoAkYNWrUCUmbefbs2bFs2TLhAQCJsGzZsnjllVcSN/cJJ5xwovQAANgaCmAAgF3sn//5nzt37NjxiCTN3NjYGA888IDwAIBEGT9+fDQ0NCRq5k6dOn1h9OjRHaQHAMCnpQAGANjFfvSjH30tk8kk6rps2rRpsWrVKuEBAImyatWqeOGFFxI1cyaTKfzpT386SnoAAHxaCmAAgF1o0KBBpX369Plqkmaur6+PCRMmCA8ASKQJEyZEXV1dombu27fvV/r27VssPQAAPg0FMADALnTZZZcdXlRUVJGkmadOnRpr164VHgCQSOvXr48pU6YkauaioqLK3/zmN0dIDwCAT0MBDACwi2Sz2cy+++57UpJmrqurc/cvAJB4jz76aOLuAt5///1PymazGekBAPBJFMAAALvI1VdfPbSsrKx3kmaeMmVKbNiwQXgAQKJt2LAhnn/++UTNXFZW1ueqq67aS3oAAHwSBTAAwC7y5S9/+bgkzVtfXx8TJ04UHACQCo8//nji7gL+0pe+dLzkAAD4JApgAIBdYPTo0R3atm07IkkzT5s2LdatWyc8ACAVPvzww5g+fXqiZm7fvv2I0aNHd5AeAABbogAGANgFfvrTn47KZDKFSZm3vr4+HnnkEcEBAKnyyCOPRH19fWLmzWQyhT/96U+/JjkAALZEAQwAsJN16tQp26dPn6OTNLO7fwGANFq3bl1MmzYtUTP36dPnmE6dOmWlBwDAx1EAAwDsZFddddUB2Wy2dVLmbWxsjEmTJgmOVOvYsWN06OCJmgD5aNKkSdHY2JiYebPZbOurrrrqAMkBAPBxFMAAADvZiBEjvp6keV988cVYtWqV4Ei1Ll26xIUXXhinnXZadO3a1UIA8siqVavipZdecj0JAEBqKIABAHaiM844o3tlZeXeSZk3l8vFxIkTBUdeyGQyMXjw4PjVr34VY8aMcUcwQB55/PHHI5fLJWbeysrKvc8444zukgMA4KMogAEAdqJTTjnlqxGRScq8CxYsiPfee09w5JVMJhN77713XHjhhTFmzJho3769pQCk3HvvvRcLFy5M1B9X/3NdCQAA/4cCGABgJ+nVq1ezXr16fTlJM3v3L/nsr0XwBRdcECeffHK0bdvWUgBSLGnXPb169fpyr169mkkOAIB/pAAGANhJrrjiioOLiopaJmXeBN4JAztEYWFhDB8+PC688MIYPXp0VFZWWgpACi1YsCCWLVuWmHmLiopaXnnllYdIDgCAf6QABgDYSYYPH/6VJM2btHfhwY5WVFQUI0aMiEsuuSRGjx4dLVu2tBSAFMnlcvH4448naub99tvvK5IDAOAfKYABAHaC0aNHd6isrByalHnXrl0bL7/8suDgI/y1CL744ovjhBNOiBYtWlgKQEq89NJLsW7dusTMW1lZudfo0aM7SA4AgL+lAAYA2AlOP/30o5J07fXMM89EQ0OD4GALiouL47DDDouxY8fGqFGjoqyszFIAEq6hoSGeeeaZJI1c8D/XmQAA8P8vEq0AAGDHymazmX79+n05KfPW1tbGlClTBAefUnFxcYwcOTIuvfTSGDVqVJSWlloKQII9//zzUVtbm5h5+/Xr9+VsNpuRHAAAf6UABgDYwX7zm9/sWVJS0jkp886YMSOqq6sFB1uppKQkRo4cGZdcckkcffTRUVJSYikACVRdXR0zZ85M0p8/na+44orBkgMA4K8UwAAAO9gXvvCFLyVl1lwuF08//bTQ4DNo3rx5HHXUUXHJJZfEyJEjI5vNWgpAwjz11FORy+USM++RRx75ZakBAPBXCmAAgB1oyJAhpZ07dz4iKfO+/vrrsWLFCsHBdlBeXh6jRo2KSy+9VBEMkDArVqyI119/PTHzdunS5fD+/ft79AQAABGhAAYA2KHGjh17aGFhYWJeCOruX9j+KioqYtSoUXHxxRfH4YcfHkVFRZYC4LpouyosLGz+H//xHwdLDQCACAUwAMAOteeeex6ZlFnXrl0b8+bNExrsIK1atYrjjz8+LrroohgxYkQUFPh2DKApmzdvXqxZsyYx8+61115HSg0AgAgFMADADnPMMce0bt269b5Jmfe5556LxsZGwcEO1qZNmxg9enRcfPHFimCAJqyxsTGee+65JP35MvyYY45pLTkAAPykAQBgBznzzDMPz2Qyibje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FpafffbZvaQFAJA+CmAAgE9p//3375+EOV9//XVhAXmjvLw8Ro0aFf/+7/8eI0eOjGw2aymA67FP6fOf//xAaQEApI8CGADgU+rRo8fuTX3G2traePvtt4UF5J2KiooYNWpUXHzxxXH44Yc3+XdvAum2ePHiRLySo1evXoOkBQCQPgpgAIBPqXXr1k3+DoklS5ZEQ0ODsIC81apVqzj++OPj4osvjhEjRkRBgW97gZ2voaEhlixZ0uTnbNOmjQIYACCFfCcMAPApDBkypLR58+a9m/qcb775prAAIqJ169YxevToGDt2rCIYcF32MZo3b95n0KBBpdICAEgX3wEDAHwKp556av9MJtPkr53eeustYQH8jTZt2sTo0aPjvPPOi+HDhyuCAddlfyOTyRT84Ac/+Jy0AADSxXe+AACfwuDBg5v84/Hq6+tj0aJFwgL4CJ06dYqTTz45/u3f/i323nvvyGQylgLsUIsXL07Eqzn23HPPgdICAEgXBTAAwKfQpUuXAU19xnfeeSfq6uqEBbAFnTt3jjFjxiiCgR2utrY23n333SRc53oPMABAyiiAAQA+hZYtW/Zv6jN6/DPAp9elS5cYM2ZMnHvuuTF48GALAfL2+iwJ17kAAGwdBTAAwCcYPnx4eUlJSeemPqfHPwNsvV69esVpp50W55xzTvTvrwMB8u/6rLS0tPPw4cPLpQUAkB4KYACAT/Ctb31rt4ho8s8IXbx4sbAAtlGfPn3irLPOinPOOSd22203CwG2i4T8gl7m29/+dj9pAQCkhwIYAOAT7L777k2+CVi7dm1s2LBBWACfUZ8+feLss8+OM888M3r27GkhwGfy4Ycfxrp165r8nAMHDlQAAwCkSJEVAABsWadOnZr8D8TefvttQQFsRwMGDIgBAwbEggULYvz48bF06VJLAbb5Oq1Vq1audwEA2GkUwAAAn6CyslIBDJCnBgwYEP3794958+bFQw89FO+++66lAFtlyZIlsddeezX1613PvgcASBEFMADAFnTq1CnbvHnzXk19ziVLlggLYAfJZDIxePDg2GOPPeLll1+OBx98MFauXGkxQGqu05o3b967Xbt2RatXr66XGABA8nkHMADAFowZM6ZnJpPJNuUZGxsbPZoUYCfIZDKx9957x4UXXhhjxoyJ9u3bWwrwiZYuXRqNjY1NesaCgoLsqaee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k8nE7NmzY+LEibFmzRoNAXif/VNSzJo161kTAwBongTAAAC70O233/7KOeecszU/P78022sdMGBAtG/f3tWu0My9+uqrMWnSpFi1apVmALyPjh07xgEHHJCIWhsbG6u/8Y1v/NXUAACaJwEwAMAutHLlyob169fP6tat2+hsrzWVSsXhhx8ekyZNMjhohubMmROTJ0+OJUuWaAbAh3D44YdHKpVKRK3r16+fVVFR0WhqAADNU54WAADsWq+++mpirts77LDDDAyamTfffDP+/d//PX7yk58IfwE+pFQqFSNGjEhMva+88sozpgYA0Hw5AQwAsIvddNNNz5166qnV+fn5rbO91m7dukX//v1j4cKFBgc5btmyZfHYY4/F/PnzNQPgIzrggAOic+fOiai1sbFxy4033jjL1AAAmi8BMADALrZy5cqG8vLyGT179vx0Euo9+uijBcCQw5YvXx7jxo0T/AJ8wv1SUpSXlz9TXl7eYGoAAM2XABgAYDeYMWPGUxdccEEiAuAhQ4ZE69ato7q62uAgh6xcuTImTJgQc+fOjUwmoyEAH1ObNm3i0EMPTUy9zz777FOmBgDQvPkGMADAbvDVr371lYaGhk1JqLWgoCCOOOIIQ4McsW7duvj5z38ed955Z8yZM0f4C/AJjRw5MvLz8xNRa0NDw8abbrrpVVMDAGjenAAGANgNKisrm1atWjW9T58+5ySh3qOPPjqefPJJQREk2Pr16+Oxxx6L2bNn+3cZYBdJpVIxatSoxNS7cuXKadXV1WmTAwBo3pwABgDYTaZNm5aY6/c6duwYAwYMMDRIoA0bNsSvf/3r+Nd//dd49dVXhb8Au9CAAQOiY8eOian36aefftLUAAAQAAMA7CZf+9rX5tTX11ckpd6jjjrK0CBBqqqq4v77749vf/vb8eKLL0ZTU5OmAOxiRx55ZGJqra+vX/eNb3zjdVMDAMAV0AAAu0ltbW16xYoVT++///6fT0K9hx56aLRt2zaqqqoMD7LYli1bYsqUKfHcc8/F9u3bNQRgN2nbtm0MGTIkMfUuX778qdraWtc/AwDgBDAAwO70xz/+cUJSas3Pz4/jjjvO0CBL1dTUxKOPPhq33XZb/OUvfxH+Auxmxx57bOTn5yel3Myvf/3rCaYGAECEABgAYLe66667llZXV89PSr1HH310tGjRwuAgi7wd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qATAAABZ4umnn968fPnyxF3xN3r06GjXrp0BAgBZqUOHDnH88ccnru5ly5ZNmD59+hYTBADgoxIAAwBkkbvvvvtPmUymKUk1FxYWxumnn254AEBWOvPMMxP3yYpMJtN41113/dH0AAD4OATAAABZ5Be/+MWatWvXTkta3UcccUT06tXLAAGArNK7d+847LDDEld3eXn5X+6///51JggAwMchAAYAyDIPP/zwn5JWcyqVijPPPNPwAICsMmbMmEilUomr+8EHH/yT6QEA8HEJgAEAsszXv/71NzZs2DAraXUPHDgwDj74YAMEALLCoEGDYsCAAYmru6KiYuatt966wAQBAPi4BMAAAFlo3Lhxv01i3WPGjIm8PFtMAGDvysvLizFjxiSy9j//+c+/NUEAAD7RflgLAACyz/XXXz+nqqrqr0mru1evXnHUUUcZIACwVx1zzDHRvXv3xNW9adOmV2666aa5JggAwCchAAYAyFJ/+tOf7k1i3WPGjInS0lIDBAD2ijZt2sRZZ52VyNofeOCBe00QAIBPSgAMAJClbrrpprlJPAVcXFwcZ555pgECAHvFWWedFS1btkxc3Zs2bXrl5ptvnmeCAAB8UgJgAIAsNm7cuF8lse5Ro0ZF7969DRAA2KP69OkTI0eOTGTtjz322K9MEACAXUEADACQxcaOHTu7qqrqb0mrO5VKxfnnnx+pVMoQAYA9tv/4/Oc/n8j9R2Vl5d+uueaav5kiAAC7ggAYACDLTZ069bdJrLtv374xZMgQAwQA9ojDDjsssTeQTJ48+TcmCADAriIABgDIcpdeeumLVVVVryax9s9//vNRXFxsiADAblVaWhrnn39+Imuvqqr66+WXX/6SKQIAsKsIgAEAEuChhx76WRLrLisri9NPP90AAYDd6qyzzoqSkpIklp753e9+91MTBABgVxIAAwAkwA033DB3w4YNs5JY+3HHHRd9+vQxRABgt+jbt28cddRRiay9oqJi1te//vU3TBEAgF1JAAwAkBA///nPfxoR6aTVnUql4vOf/3zk5dl6AgC7Vn5+flx00UWRSqWSWH76F7/4xX+bIgAAu5q3cAAACXHHHXe8tW7duulJrL13795xzDHHGCIAsEudcMIJ0b1790TWXl5e/pc77rjjLVMEAGBXEwADACTI3XfffW8mk2lKYu1nnXVWtG3b1hAB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onv37vEv//IvccABBzSrdWcymaYnnnji9s997nPPeAoAAODDEQADAJBYDz/88NJjjjlmY+/evY+KiGZzFKq0tDSGDx8eq1evjvXr13sQAHLcwIED45prrol27do1t6VnZsyY8YOzzjprqqcAAAA+PAEwAACJdv/99795zDHHVO6zzz5HRDMKgVu0aBGHHXZYtGzZMhYuXBjpdNrDAJBjCgoK4pxzzonzzz8/WrRo0dyWn37uuefuOuWUUyZ4EgAA4KMRAAMAkHi///3v5w8bNmxF3759j2lO10GnUqno27dvDB06NBYvXhxbtmzxMADkiJ49e8YNN9wQgwcPblbf+434x7XPU6ZM+fbpp58+2ZMAAAAfnQAYAICc8OCDDy4ZNmzYin79+jWrEDgionXr1nHEEUdEfX19LF261MMAkGCpVCpOOOGEuOKKK6JNmzbNbv07wt9vnXPOOX/xNAAAwMcjAAYAIGc89NBDS4YNG7a8X79+xza3EDg/Pz8OPvjg6NWrV8yfPz8aGho8EAAJU1JSEpdffnmccMIJkZ+f3+zWn8lkGp944olvffazn53maQAAgI9PAAwAQE556KGHlo4cOXJdnz59RqWa252ZEdG1a9cYNmxYLFu2LCorKz0QAAnRt2/fuO6662K//fZrluvPZDLpp59++rvnnHPO054GAAD4ZATAAADknD/96U+LDj300KX7779/s7sOOiKiuLg4jjzyyCgpKYk333wz0um0hwIgSxUUFMRnP/vZuPDCC6OkpKRZ9iCdTjc88sgjt5x//vnTPREAAPDJCYABAMhJDz/88NId3wQelUqlmt09mqlUKvr06RMHH3xwLFy4MLZt2+ahAMgynTt3jrFjx8bQoUOjGV5aERH/CH+feOKJ2y+88MLnPBEAALBrCIABAMhZDz300JIePXq8NmjQoGPz8vJaNMcetG3bNkaNGhVNTU2xZMkSDwVAFkilUjF69Oi48soro0OHDs22D01NTdt++9vf/stll132oqcCAAB2HQEwAAA5bdKkSeXdu3efM3jw4GYbAufn58eAAQOiV69esWDBgti+fbsHA2Avad26dVx66aVx/PHHR35+frPtQ2NjY/WvfvWrf7nuuute81QAAMCuJQAGACDnTZ48eW1jY+OMI4444uiCgoKS5tqHrl27xqhRo2Lbtm2xcuVKDwbAHpRKpWLUqFExduzY6NWrV7PuRX19/fo77rjjK9/61rcWejIAAGDXEwADANAsPP/881UbNmx45rjjjjuqsLCwrLn2obCwMAYNGhT77bdfLF68OGpraz0cALtZ+/bt44orrogTTzwxCgub9/uU2tralTfffPPVP/nJT1Z7MgAAYPcQAAMA0Gz87W9/27p27doZJ5xwwsjCwsK2zbkXnTp1ipEjR0Z1dbXTwAC70ciRI+Pqq6+OHj16NPte1NTULL/hhhuu/e1vf7vOkwEAALuPABgAgGbltdde2zpv3rynTznllKFFRUWdmnMvCgsL49BDD4399tsvFi1a5DQwwC709qnfk08+udmf+o2I2Lx587yLL774unHjxm30dAAAwO71fgFwat9zYsTOftC4LmLjq610DwCAxOrVq1fhs88++69du3Y9QTciGhoaYurUqTF58uRobGzUEICPqaCgIE499dQYPXq04HeH8vLyp4499tjvrly5skE3AABg9+swrDYKuuz8ZwJgAAByWuvWrfNeeumlm/fdd9+zdeMfVq9eHffff38sWbJEMwA+ov322y8uuugi1z2/w8KFC38/fPjwnzY0NGR0AwAA9gwBMAAAzd7zzz9/8aGHHnp1RKR0IyKTycTMmTPjz3/+c9TV1WkIwAcoKSmJ8847L0aMGBGplL9Kdki//PLL9xx77LEPagUAAOxZ7xcA+wYwAADNwn333Tfn+OOP39yrV6/DQwgcqVQqevfuHcOHD49169ZFRUWFhwTgPRxyyCExduzY6N+/v/B3h0wm0/jMM8/828knnzxONwAAYM97v28AC4ABAGg2fve7370xePDgJf369Ts6lUrl60hEcXFxjBgxInr06BFLly6N2tpaTQHYoUOHDvGFL3whzjzzzCguLtaQHZqammoeeOCBWz73uc9N1w0AANg7BMAAALDDww8/vKygoOC54cOHH1FQUFCqI//QrVu3OO6446K0tDQWL14cTU1NmgI0Wy1btoxzzjknLr300ujevbuGvENtbe2K22677arbbrvtDd0AAIC9RwAMAADv8Oyzz25avHjx0yeddNKQoqKiTjryD3l5edGnT58YOXJkbN26NVatWqUpQLNz+OGHx1e+8pUYMGBA5OXlacg7VFVV/e3CCy+8/oEHHvDdAAAA2MsEwAAA8C7z58+vefbZZ58+44wz+hcX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OigOOOCAKCoq0pQs0djYuGXmzJk/PvPMMyc2NDS4XgAAAPjQBMAAAJADjjzyyNY/+9nPrujbt++5EZGnI9mluro6Fi5cGPPnz4958+ZFZWWlprBXtGvXLg455JAYMGBA9O/fP1q39nsjWSj91ltv/fmqq676xaxZs6q1AwAA+KgEwAAAkEN++ctfjhgzZsyNrVq16q0b2SmdTsfKlStj0aJFsXDhwli8eHFs27ZNY9gtSkpKol+/ftG/f//Yf//9o1evXpGX53dEslVNTc3yRx999EdXXnnlK7oBAAB8XAJgAADIMd26dSt8+OGHPzd48ODL8vPzbdyzXCaTiTVr1sTChQtj0aJFsWjRotiyZYvG8LGUlZVF//79/xn6du/ePVKplMZkuaampprXXnvtV2PGjHmgoqKiUUcAAIBPQgAMAAA56rjjjiv7r//6r8tdC508mzdvjuXLl8eKFSti+fLlsXjx4qipqdEY/pfi4uLo169f9O7dO/bZZ5/Yd999o6ysTGMSJJPJpJcsWfLn66677pfTp0/3mx8AAMAuIQAGAIAc99Of/nTIueeee3NpaWlf3UimxsbGWLlyZSxdujSWLVsWy5cvj3Xr1kUmk9GcZiKVSkWXLl1in332iT59+kSfPn2iV69eUVBQoDkJtXXr1sUPPvjgj6699tq/6wYAALArCYABAKAZaNeuXf64cePOGTp06BUFBQWtdST56uvrY+XKlf88KbxixYpYu3ZtpNNpzUm4vLy86Nq1a+yzzz7//KdXr17RsmVLzckBjY2NW/7617/+4pxzznm0srKySUcAAIBdTQAMAADNyIknntjmnnvuuXzfffcdk0qlHB3MMdu3b481a9bEmjVrYu3atbF27dooLy+PDRs2CIazUF5eXnTs2DG6desWXbt2jW7dukW3bt2iR48eUVhYqEE5JpPJNC5ZsuRR1z0DAAC7mwAYAACaoa9+9av7Xnfdddd16NDhCN3IfY2Njf8MhNetWxfr1q2LioqKWLduXWzbtk2DdrPS0tLo3LnzP//p0qVLdO3aNbp27eoK52Ziw4YNM//rv/7rxz/60Y+W6wYAALC7CYABAKAZ++UvfznirLPOuq64uNj3gZupmpqaWL9+/T//qaioiMrKyqisrIxNmzZFY2OjJn2AgoKCaN++fbRr1y7at28fHTt2jC5dukSnTp2ic+fOUVxcrEnN1NatW98aP378PVdcccXLugEAAOwpAmAAAGjm2rVrl//ggw+eOWLEiCsLCwvb6gjvtHnz5n+GwZs2bYrKysqorq6OLVu2xJYtW6K6ujqqq6sjk8nk3NpTqVS0bt06WrduHWVlZdGmTZsoLS39X2Fvu3btok2bNh4U/peGhobKl1566efnnHPO+OrqavevAwAAe5QAGAAAiIiIoUOHFt97770XHHjggRfk5+c7ssiHlk6n/xkEV1dXR01Nzfv+k8lkora2NtLpdNTX10dTU1PU1dXt0u8U5+XlRcuWLSM/Pz+KiooiLy8vWrVqFalUKoqLi3f6T0lJSbRq1eqfgW9paWnk5eUZMB9aU1NTzYIFC/745S9/+Y+zZ8+u0REAAGBvEAADAAD/y2mnndb2rrvuurRPnz5n5+XlFeoIe9LbgfDbtm/f/r7XUBcUFESLFi3++b/fDnxhT8pkMg1LliwZd8stt/xq0qRJVToCAADsTQJgAABgp0477bS2d95554X777//5wTBAP9XJpNpWLhw4QO33nrrHwS/AABAtni/ADi/7UHRc2c/SG+LqC33/gcAAHLZokWL6u69995X0un0swcddFCnkpKS3roC8A8VFRUz/7//7/+77aKLLpq6aNGiOh0BAACyRXH3xsgr3fnPBMAAAEDMnDmz8u67736qqalpWr9+/Ypbt27dN5VKpXQGaG4ymUx6zZo1U+65555/Peeccx6cOXNmpa4AAADZRgAMAAB8KDNnzqz88Y9//Gw6nZ4uCAaak7eD37vvvvtfzz///McEvwAAQDYTAAMAAB+JIBhoLgS/AABAEgmAAQCAj+XtILisrOyFvn37diwuLu4VEYJgIBdkKioqnrv33nu/PWbMmEcEvwAAQJK8XwCc2vecGLGzHzSui9j4aivdAwAA/unqq6/u8ZWvfOX8Pn36nJWXl9dCR4CkSafT9UuXLh3/X//1Xw/84he/WKMjAABAEnUYVhsFXXb+MwEwAADwkZ1xxhntb7/99rMPPPDA8/Pz81vrCJDtmpqaqhcsWPDgd77znUcmTpzotC8AAJBoAmAAAGC3GD58eMkPf/jDzwwePPjioqKijjoCZJv6+voNr7322u9vvPHGx2fPnl2jIwAAQC4QAAMAALvV0KFDi++5556zDjnkkPOKioq66giwt9XV1a19/fXXH7z++uvHC34BAIBcIwAGAAD2iFatWuXdc889w0455ZTzO3bseJSOAHtYZsOGDbOmTJny4PXXX/9qbW1tWksAAIBcJAAGAAD2uH/913/tf/7555/dq1ev0/Ly8lroCLC7pNPp+pUrV05+4IEHHvnOd76zSEcAAIBcJwAGAAD2mjPOOKP97bfffvYBBxzw2YKCgjY6AuwqjY2NVW+++eafv/e97z06YcKETToCAAA0FwJgAABgrxs+fHjJ97///dGDBg0aU1paur+OAB9XdXX1wtdee+3Rr371q1Nfe+21Wh0BAACaGwEwAACQVb761a/ue8EFF3y6b9++ZxUUFLTWEeCDNDY2bnnrrbfG/+EPf5j4ox/9aLmOAAAAzZkAGAAAyEpDhw4t/sEPfnDy4MGDz27dunV/HQHerbq6+s2XX375weuuu+7ppUuXbtcRAAAAATAAAJDlCgsLU3ffffeQ0aNHn9G1a9fj8vLyinQFmq90Ol1XXl4+bcqUKROuvfbav+sIAADA/yYABgAAEqNPnz4t/v3f/33UyJEjz2rfvv2nIiKlK9AsZDZt2vTXF1544bGvfe1rzzntCwAA8N4EwAAAQCJddNFFXa6++uqTDzzwwLNbtmzZTUcg99TV1a1ZsGDBuJ/+9KdP3n///et0BAAA4IMJgAEAgETr1q1b4d13333k4YcffmqHDh2OyMvLK9QVSK50Ot2wcePGWbNmzZp8/fXXz6qoqGjUFQAAgA9PAAwAAOSMo48+uvWtt956/CGHHHJKu3btBkdEnq5AIqQrKytfmzdv3uQ777xz+owZM6q1BAAA4OMRAAMAADnpuOOOK/vGN75x/CGHHHJa27ZtB4bvBUO2yVRVVc2dN2/epO9///vTpk+fvkVLAAAAPjkBMAAAkPNuu+22vmedddZJffr0Oa5Vq1a9dQT2ntra2uXLly+f/uijjz51xx13vKUjAAAAu5YAGAAAaFa+9KUvdbv44ouP7t+//wlOBsMekamqqpq7cOHCv/z+97+fcd9995VrCQAAwO4jAAYAAJqtSy65pOtll112jDAYdrl0VVXVvIULF/7lV7/61bO/+93v1moJAADAniEABgAAiIirr766x/nnnz9q//33P7JNmzZDUqlUga7Ah5fJZBoqKyv/vnjx4uf+9Kc/zbr33ntX6woAAMCeJwAGAAB4l379+hV97WtfGzRy5MhRPXv2PLaoqKizrsD/VV9fv37VqlXPvPDCC8/9+7//+5zFixfX6woAAMDeJQAGAAB4H61bt8678847Bx599NFHde/efURpaen+4apomq/M1q1bF69Zs+bF5557btY3v/nNOdXV1WltAQAAyB4CYAAAgI9g8ODBrcaOHXvI8OHDD+vevfvw1q1bHxACYXJXprq6+s01a9a88sorr7z8k5/8ZN5rr71Wqy0AAADZSwAMAADwCVx//fX7nHHGGYf169dvePv27Yfm5+e31hWSrLGxsXrjxo2vvvXWWy+PHz/+lR//+McrdQUAACA5BMAAAAC70Je//OUe55xzzvA+ffoM7tix45CioqKuukI2q6+vX7t27doXFy9ePGfixImv3Xvvvat1BQAAILkEwAAAALvRl7/85R6f+cxnBvfr129Qly5dDm/ZsqVAmL2qrq5u7bp16wS+AAAAOUoADAAAsIe0atUq75prrtnn2GOPPXi//fY7uH379oeUlpb2TaVS+brDbpKuqalZtnHjxnlvvfXW3GeffXbef/3Xfy2vra1Naw0AAEBuEgADAADsRQceeGDLq6+++oAhQ4Yc3LNnz4Pbtm17sGuj+biampqqq6qqXi8vL583Z86ceb/85S/nvfjii1t1BgAAoPkQAAMAAGSZoUOHFn/xi1/cf9CgQQf26NHjwHbt2h3YqlWr3qlUKk932CFdU1OzvLKycsHq1asXzJkzZ8Gf//znJTNmzKjWGgAAgOZNAAwAAJAAxx13XNkFF1xw4MEHH3xA165dDywtLd23pKRkn1QqVag7uS2TyTRs27ZtRXV19dJ169YtfOONNxZOmDBh4YQJEzbpDgAAAO8mAAYAAEiw8847r+OJJ57Yp3///vt16dKlT5s2bfZr3bp1v/z8/GLdSZampqaa6urqxZs3b16ybt26pQsXLlzy9NNPL33ooYc26A4AAAAflgAYAAAgx7Rr1y7/kksu6TFkyJCe++67b89OnTr1Kisr61VcXNyzZcuW3VKpVL4u7R2ZTKaprq6uvKamZtWWLVtWVlRUrFy6dOnK2bNnr7r//vvXVFZWNukSAAAAn4QAGAAAoBnp1KlTwec+97luQ4cO7bnPPvv0aNeuXafWrVt3Li4u7tqyZcvORUVFnfLy8lro1MeTTqe319fXr6+rq6uoqalZW11dvb6y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AACAEgIwAAAAAAAAQAkBGAAAAAAAAKCEAAwAAAAAAABQQgAGAAAAAAAAKCEAAwAAAAAAAJQQgAEAAAAAAABKCMAAAAAAAAAAJQRgAAAAAAAAgBICMAAAAAAAAEAJARgAAAAAAACghAAMAAAAAAAAUEIABgAAAAAAACghAAMAAAAAAACUEIABAAAAAAAASgjAAAAAAAAAACUEYAAAAAAAAIASAjAAAAAAAABACQEYAAAAAAAAoIQADAAAAAAAAFBCAAYAAAAAAAAoIQADAAAAAAAAlBCAAQAAAAAAAEoIwAAAAAAAAAAlBGAAAAAAAACAEgIwAAAAAAAAQAkBGAAAAAAAAKCEAAwAAAAAAABQQgAGAAAAAAAAKCEAAwAAAAAAAJQQgAEAAAAAAABKCMAAAAAAAAAAJQRgAAAAAAAAgBICMAAAAAAAAEAJARgAAAAAAACghAAMAAAAAAAAUEIABgAAAAAAACghAAMAAAAAAACUEIABAAAAAAAASgjAAAAAAAAAACUEYAAAAAAAAIASAjAAAAAAAABACQEYAAAAAAAAoIQADAAAAAAAAFBCAAYAAAAAAAAoIQADAAAAAAAAlBCAAQAAAAAAAEoIwAAAAAAAAAAlBGAAAAAAAACAEgIwAAAAAAAAQAkBGAAAAAAAAKCEAAwAAAAAAABQQgAGAAAAAAAAKCEAAwAAAAAAAJQQgAEAAAAAAABKCMAAAAAAAAAAJQRgAAAAAAAAgBICMAAAAAAAAEAJARgAAAAAAACghAAMAAAAAAAAUEIABgAAAAAAACghAAMAAAAAAACUEIABAAAAAAAASgjAAAAAAAAAACUEYAAAAAAAAIASAjAAAAAAAABACQEYAAAAAAAAoIQADAAAAAAAAFBCAAYAAAAAAAAoIQADAAAAAAAAlBCAAQAAAAAAAEoIwAAAAAAAAAAlBGAAAAAAAACAEgIwAAAAAAAAQAkBGAAAAAAAAKCEAAwAAAAAAABQQgAGAAAAAAAAKCEAAwAAAAAAAJQQgAEAAAAAAABKCMAAAAAAAAAAJQRgAAAAAAAAgBICMAAAAAAAAEAJARgAAAAAAACghAAMAAAAAAAAUEIABgAAAAAAACghAAMAAAAAAACUEIABAAAAAAAASgjAAAAAAAAAACUEYAAAAAAAAIASAjAAAAAAAABACQEYAAAAAAAAoIQADAAAAAAAAFBCAAYAAAAAAAAoIQADAAAAAAAAlBCAAQAAAAAAAEoIwAAAAAAAAAAlBGAAAAAAAACAEgIwAAAAAAAAQAkBGAAAAAAAAKCEAAwAAAAAAABQQgAGAAAAAAAAKCEAAwAAAAAAAJQQgAEAAAAAAABKCMAAAAAAAAAAJQRgAAAAAAAAgBICMAAAAAAAAEAJARgAAAAAAACghAAMAAAAAAAAUEIABgAAAAAAACghAAMAAAAAAACUEIABAAAAAAAASgjAAAAAAAAAACUEYAAAAAAAAIASAjAAAAAAAABACQEYAAAAAAAAoIQADAAAAAAAAFBCAAYAAAAAAAAoIQADAAAAAAAAlBCAAQAAAAAAAEoIwAAAAAAAAAAlBGAAAAAAAACAEgIwAAAAAAAAQAkBGAAAAAAAAKCEAAwAAAAAAABQQgAGAAAAAAAAKCEAAwAAAAAAAJQQgAEAAAAAAABKCMAAAAAAAAAAJQRgAAAAAAAAgBICMAAAAAAAAEAJARgAAAAAAACghAAMAAAAAAAAUEIABgAAAAAAACghAAMAAAAAAACUEIABAAAAAAAASgjAAAAAAAAAACUEYAAAAAAAAIASAjAAAAAAAABACQEYAAAAAAAAoIQADAAAAAAAAFBCAAYAAAAAAAAoIQADAAAAAAAAlBCAAQAAAAAAAEoIwAAAAAAAAAAlBGAAAAAAAACAEgIwAAAAAAAAQAkBGAAAAAAAAKCEAAwAAAAAAABQQgAGAAAAAAAAKCEAAwAAAAAAAJQQgAEAAAAAAABKCMAAAAAAAAAAJQRgAAAAAAAAgBICMAAAAAAAAEAJARgAAAAAAACghAAMAAAAAAAAUEIABgAAAAAAACghAAMAAAAAAACUEIABAAAAAAAASgjAAAAAAAAAACUEYAAAAAAAAIASAjAAAAAAAABACQEYAAAAAAAAoIQADAAAAAAAAFBCAAYAAAAAAAAoIQADAAAAAAAAlBCAAQAAAAAAAEoIwAAAAAAAAAAlBGAAAAAAAACAEgIwAAAAAAAAQAkBGAAAAAAAAKCEAAwAAAAAAABQQgAGAAAAAAAAKCEAAwAAAAAAAJQQgAEAAAAAAABKCMAAAAAAAAAAJQRgAAAAAAAAgBICMAAAAAAAAEAJARgAAAAAAACghAAMAAAAAAAAUEIABgAAAAAAACghAAMAAAAAAACUEIABAAAAAAAASgjAAAAAAAAAACUEYAAAAAAAAIASAjAAAAAAAABACQEYAAAAAAAAoIQADAAAAAAAAFBCAAYAAAAAAAAoIQADAAAAAAAAlBCAAQAAAAAAAEoIwAAAAAAAAAAlBGAAAAAAAACAEgIwAAAAAAAAQAkBGAAAAAAAAKCEAAwAAAAAAABQQgAGAAAAAAAAKCEAAwAAAAAAAJQQgAEAAAAAAABKCMAAAAAAAAAAJQRgAAAAAAAAgBICMAAAAAAAAEAJARgAAAAAAACghAAMAAAAAAAAUEIABgAAAAAAACghAAMAAAAAAACUEIABAAAAAAAASgjAAAAAAAAAACUEYAAAAAAAAIASAjAAAAAAAABACQEYAAAAAAAAoIQADAAAAAAAAFBCAAYAAAAAAAAoMY3JP//9K8My551lzpAk293a7QAAAAAAAAD8iIw3r+SL7TpPxuSt4/ibJJuz20QDBgAAAAAAAHhzrJPp6NvHYcyyjLl7dJTPbl/Jp6sPLufSsM+5ec7q5YOrF0OeP/SVaAAAAAAAAIA3weH7u6zfm79dWDIMSw6225w785vsx3XyzasOby5ssz69c4sAAAAAAAAAr9n69C6bC9sT93a7rKdnORin5Otxynzi1JQcfiwCAwAAAAAAALxO69O7HH68TaaT98cp85R8vbp3Nfszv8q0LHn7xMF1sjk/ZzUPmZ/MmWefhAYAAAAAAAD4oayPdjn7223Gn7x6ZrXPnetX8mBKkpv3cufDd/Pufn5FL56SzcVtNheT3dNt8tQlAwAAAAAAAHyv1sm0ySv/9XtsNWZ3I/lHkgzHi7/4XY7WYz5yiwAAAAAAAAA/Ivtcv/3nPEyS1fHa42t5+vNLyX7JoRsCAAAAAAAAePPt1/nbV3/KvePn1Xc371/NYxEYAAAAAAAA4M0yTHk2rvNo2WdzvHZqzN9v/SF3vju3evng/at5fPDLPDu1yuGyZHSVAAAAAAAAAK/XOGe4ueSvZ4e8M8xZbVe5ceuPufvy3Oqkw4+v5emDX+fuuTlLhhwsEYIBAAAAAAAAXpclGR8OuXP0TR4cPM/9z/+SRyfNDf/1TZezOp/87KdjzizJZkhO7edMy/w/nAUAAAAAAADg/zaMWcZkP8/ZLsmLacr2/MV8+cnvs/tP5/4FmLjAq1ifcioAAAAASUVORK5CYII=";
function getSmartParseNumber(size, xyDir, layout) {
  if (typeof size === "string" && !isNaN(Number(size)))
    size = Number(size);
  if (typeof size === "number" && size < 100)
    return inch2Emu(size);
  if (typeof size === "number" && size >= 100)
    return size;
  if (typeof size === "string" && size.includes("%")) {
    if (xyDir && xyDir === "X")
      return Math.round(parseFloat(size) / 100 * layout.width);
    if (xyDir && xyDir === "Y")
      return Math.round(parseFloat(size) / 100 * layout.height);
    return Math.round(parseFloat(size) / 100 * layout.width);
  }
  return 0;
}
function getUuid(uuidFormat) {
  return uuidFormat.replace(/[xy]/g, function(c) {
    const r = Math.random() * 16 | 0;
    const v = c === "x" ? r : r & 3 | 8;
    return v.toString(16);
  });
}
function encodeXmlEntities(xml) {
  if (typeof xml === "undefined" || xml == null)
    return "";
  return xml.toString().replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&apos;");
}
function inch2Emu(inches) {
  if (typeof inches === "number" && inches > 100)
    return inches;
  if (typeof inches === "string")
    inches = Number(inches.replace(/in*/gi, ""));
  return Math.round(EMU * inches);
}
function valToPts(pt) {
  const points = Number(pt) || 0;
  return isNaN(points) ? 0 : Math.round(points * ONEPT);
}
function convertRotationDegrees(d) {
  d = d || 0;
  return Math.round((d > 360 ? d - 360 : d) * 6e4);
}
function componentToHex(c) {
  const hex = c.toString(16);
  return hex.length === 1 ? "0" + hex : hex;
}
function rgbToHex(r, g, b) {
  return (componentToHex(r) + componentToHex(g) + componentToHex(b)).toUpperCase();
}
function createColorElement(colorStr, innerElements) {
  let colorVal = (colorStr || "").replace("#", "");
  if (!REGEX_HEX_COLOR.test(colorVal) && colorVal !== SchemeColor.background1 && colorVal !== SchemeColor.background2 && colorVal !== SchemeColor.text1 && colorVal !== SchemeColor.text2 && colorVal !== SchemeColor.accent1 && colorVal !== SchemeColor.accent2 && colorVal !== SchemeColor.accent3 && colorVal !== SchemeColor.accent4 && colorVal !== SchemeColor.accent5 && colorVal !== SchemeColor.accent6) {
    console.warn(`"${colorVal}" is not a valid scheme color or hex RGB! "${DEF_FONT_COLOR}" used instead. Only provide 6-digit RGB or 'pptx.SchemeColor' values!`);
    colorVal = DEF_FONT_COLOR;
  }
  const tagName = REGEX_HEX_COLOR.test(colorVal) ? "srgbClr" : "schemeClr";
  const colorAttr = 'val="' + (REGEX_HEX_COLOR.test(colorVal) ? colorVal.toUpperCase() : colorVal) + '"';
  return innerElements ? `<a:${tagName} ${colorAttr}>${innerElements}</a:${tagName}>` : `<a:${tagName} ${colorAttr}/>`;
}
function createGlowElement(options, defaults) {
  let strXml = "";
  const opts = Object.assign(Object.assign({}, defaults), options);
  const size = Math.round(opts.size * ONEPT);
  const color = opts.color;
  const opacity = Math.round(opts.opacity * 1e5);
  strXml += `<a:glow rad="${size}">`;
  strXml += createColorElement(color, `<a:alpha val="${opacity}"/>`);
  strXml += "</a:glow>";
  return strXml;
}
function genXmlColorSelection(props) {
  let fillType = "solid";
  let colorVal = "";
  let internalElements = "";
  let outText = "";
  if (props) {
    if (typeof props === "string")
      colorVal = props;
    else {
      if (props.type)
        fillType = props.type;
      if (props.color)
        colorVal = props.color;
      if (props.alpha)
        internalElements += `<a:alpha val="${Math.round((100 - props.alpha) * 1e3)}"/>`;
      if (props.transparency)
        internalElements += `<a:alpha val="${Math.round((100 - props.transparency) * 1e3)}"/>`;
    }
    switch (fillType) {
      case "solid":
        outText += `<a:solidFill>${createColorElement(colorVal, internalElements)}</a:solidFill>`;
        break;
      default:
        outText += "";
        break;
    }
  }
  return outText;
}
function getNewRelId(target) {
  return target._rels.length + target._relsChart.length + target._relsMedia.length + 1;
}
function correctShadowOptions(ShadowProps) {
  if (!ShadowProps || typeof ShadowProps !== "object") {
    return;
  }
  if (ShadowProps.type !== "outer" && ShadowProps.type !== "inner" && ShadowProps.type !== "none") {
    console.warn("Warning: shadow.type options are `outer`, `inner` or `none`.");
    ShadowProps.type = "outer";
  }
  if (ShadowProps.angle) {
    if (isNaN(Number(ShadowProps.angle)) || ShadowProps.angle < 0 || ShadowProps.angle > 359) {
      console.warn("Warning: shadow.angle can only be 0-359");
      ShadowProps.angle = 270;
    }
    ShadowProps.angle = Math.round(Number(ShadowProps.angle));
  }
  if (ShadowProps.opacity) {
    if (isNaN(Number(ShadowProps.opacity)) || ShadowProps.opacity < 0 || ShadowProps.opacity > 1) {
      console.warn("Warning: shadow.opacity can only be 0-1");
      ShadowProps.opacity = 0.75;
    }
    ShadowProps.opacity = Number(ShadowProps.opacity);
  }
  if (ShadowProps.color) {
    if (ShadowProps.color.startsWith("#")) {
      console.warn('Warning: shadow.color should not include hash (#) character, , e.g. "FF0000"');
      ShadowProps.color = ShadowProps.color.replace("#", "");
    }
  }
  return ShadowProps;
}
function parseTextToLines(cell, colWidth, verbose) {
  var _a, _b;
  const FOCO = 2.3 + (((_a = cell.options) === null || _a === void 0 ? void 0 : _a.autoPageCharWeight) ? cell.options.autoPageCharWeight : 0);
  const CPL = Math.floor(colWidth / ONEPT * EMU) / ((((_b = cell.options) === null || _b === void 0 ? void 0 : _b.fontSize) ? cell.options.fontSize : DEF_FONT_SIZE) / FOCO);
  const parsedLines = [];
  let inputCells = [];
  const inputLines1 = [];
  const inputLines2 = [];
  if (cell.text && cell.text.toString().trim().length === 0) {
    inputCells.push({ _type: SLIDE_OBJECT_TYPES.tablecell, text: " " });
  } else if (typeof cell.text === "number" || typeof cell.text === "string") {
    inputCells.push({ _type: SLIDE_OBJECT_TYPES.tablecell, text: (cell.text || "").toString().trim() });
  } else if (Array.isArray(cell.text)) {
    inputCells = cell.text;
  }
  let newLine = [];
  inputCells.forEach((cell2) => {
    var _a2;
    if (typeof cell2.text === "string") {
      if (cell2.text.split("\n").length > 1) {
        cell2.text.split("\n").forEach((textLine) => {
          newLine.push({
            _type: SLIDE_OBJECT_TYPES.tablecell,
            text: textLine,
            options: Object.assign(Object.assign({}, cell2.options), { breakLine: true })
          });
        });
      } else {
        newLine.push({
          _type: SLIDE_OBJECT_TYPES.tablecell,
          text: cell2.text.trim(),
          options: cell2.options
        });
      }
      if ((_a2 = cell2.options) === null || _a2 === void 0 ? void 0 : _a2.breakLine) {
        inputLines1.push(newLine);
        newLine = [];
      }
    }
    if (newLine.length > 0) {
      inputLines1.push(newLine);
      newLine = [];
    }
  });
  inputLines1.forEach((line) => {
    line.forEach((cell2) => {
      const lineCells = [];
      const cellTextStr = String(cell2.text);
      const lineWords = cellTextStr.split(" ");
      lineWords.forEach((word, idx) => {
        const cellProps = Object.assign({}, cell2.options);
        if (cellProps === null || cellProps === void 0 ? void 0 : cellProps.breakLine)
          cellProps.breakLine = idx + 1 === lineWords.length;
        lineCells.push({ _type: SLIDE_OBJECT_TYPES.tablecell, text: word + (idx + 1 < lineWords.length ? " " : ""), options: cellProps });
      });
      inputLines2.push(lineCells);
    });
  });
  inputLines2.forEach((line) => {
    let lineCells = [];
    let strCurrLine = "";
    line.forEach((word) => {
      if (strCurrLine.length + word.text.length > CPL) {
        parsedLines.push(lineCells);
        lineCells = [];
        strCurrLine = "";
      }
      lineCells.push(word);
      strCurrLine += word.text.toString();
    });
    if (lineCells.length > 0)
      parsedLines.push(lineCells);
  });
  return parsedLines;
}
function getSlidesForTableRows(tableRows = [], tableProps = {}, presLayout, masterSlide) {
  let arrInchMargins = DEF_SLIDE_MARGIN_IN;
  let emuSlideTabW = EMU * 1;
  let emuSlideTabH = EMU * 1;
  let emuTabCurrH = 0;
  let numCols = 0;
  const tableRowSlides = [];
  const tablePropX = getSmartParseNumber(tableProps.x, "X", presLayout);
  const tablePropY = getSmartParseNumber(tableProps.y, "Y", presLayout);
  const tablePropW = getSmartParseNumber(tableProps.w, "X", presLayout);
  const tablePropH = getSmartParseNumber(tableProps.h, "Y", presLayout);
  let tableCalcW = tablePropW;
  function calcSlideTabH() {
    let emuStartY = 0;
    if (tableRowSlides.length === 0)
      emuStartY = tablePropY || inch2Emu(arrInchMargins[0]);
    if (tableRowSlides.length > 0)
      emuStartY = inch2Emu(tableProps.autoPageSlideStartY || tableProps.newSlideStartY || arrInchMargins[0]);
    emuSlideTabH = (tablePropH || presLayout.height) - emuStartY - inch2Emu(arrInchMargins[2]);
    if (tableRowSlides.length > 1) {
      if (typeof tableProps.autoPageSlideStartY === "number") {
        emuSlideTabH = (tablePropH || presLayout.height) - inch2Emu(tableProps.autoPageSlideStartY + arrInchMargins[2]);
      } else if (typeof tableProps.newSlideStartY === "number") {
        emuSlideTabH = (tablePropH || presLayout.height) - inch2Emu(tableProps.newSlideStartY + arrInchMargins[2]);
      } else if (tablePropY) {
        emuSlideTabH = (tablePropH || presLayout.height) - inch2Emu((tablePropY / EMU < arrInchMargins[0] ? tablePropY / EMU : arrInchMargins[0]) + arrInchMargins[2]);
        if (emuSlideTabH < tablePropH)
          emuSlideTabH = tablePropH;
      }
    }
  }
  if (tableProps.verbose) {
    console.log("[[VERBOSE MODE]]");
    console.log("|-- TABLE PROPS --------------------------------------------------------|");
    console.log(`| presLayout.width ................................ = ${(presLayout.width / EMU).toFixed(1)}`);
    console.log(`| presLayout.height ............................... = ${(presLayout.height / EMU).toFixed(1)}`);
    console.log(`| tableProps.x .................................... = ${typeof tableProps.x === "number" ? (tableProps.x / EMU).toFixed(1) : tableProps.x}`);
    console.log(`| tableProps.y .................................... = ${typeof tableProps.y === "number" ? (tableProps.y / EMU).toFixed(1) : tableProps.y}`);
    console.log(`| tableProps.w .................................... = ${typeof tableProps.w === "number" ? (tableProps.w / EMU).toFixed(1) : tableProps.w}`);
    console.log(`| tableProps.h .................................... = ${typeof tableProps.h === "number" ? (tableProps.h / EMU).toFixed(1) : tableProps.h}`);
    console.log(`| tableProps.slideMargin .......................... = ${tableProps.slideMargin ? String(tableProps.slideMargin) : ""}`);
    console.log(`| tableProps.margin ............................... = ${String(tableProps.margin)}`);
    console.log(`| tableProps.colW ................................. = ${String(tableProps.colW)}`);
    console.log(`| tableProps.autoPageSlideStartY .................. = ${tableProps.autoPageSlideStartY}`);
    console.log(`| tableProps.autoPageCharWeight ................... = ${tableProps.autoPageCharWeight}`);
    console.log("|-- CALCULATIONS -------------------------------------------------------|");
    console.log(`| tablePropX ...................................... = ${tablePropX / EMU}`);
    console.log(`| tablePropY ...................................... = ${tablePropY / EMU}`);
    console.log(`| tablePropW ...................................... = ${tablePropW / EMU}`);
    console.log(`| tablePropH ...................................... = ${tablePropH / EMU}`);
    console.log(`| tableCalcW ...................................... = ${tableCalcW / EMU}`);
  }
  {
    if (!tableProps.slideMargin && tableProps.slideMargin !== 0)
      tableProps.slideMargin = DEF_SLIDE_MARGIN_IN[0];
    if (masterSlide && typeof masterSlide._margin !== "undefined") {
      if (Array.isArray(masterSlide._margin))
        arrInchMargins = masterSlide._margin;
      else if (!isNaN(Number(masterSlide._margin))) {
        arrInchMargins = [Number(masterSlide._margin), Number(masterSlide._margin), Number(masterSlide._margin), Number(masterSlide._margin)];
      }
    } else if (tableProps.slideMargin || tableProps.slideMargin === 0) {
      if (Array.isArray(tableProps.slideMargin))
        arrInchMargins = tableProps.slideMargin;
      else if (!isNaN(tableProps.slideMargin))
        arrInchMargins = [tableProps.slideMargin, tableProps.slideMargin, tableProps.slideMargin, tableProps.slideMargin];
    }
    if (tableProps.verbose)
      console.log(`| arrInchMargins .................................. = [${arrInchMargins.join(", ")}]`);
  }
  {
    const firstRow = tableRows[0] || [];
    firstRow.forEach((cell) => {
      if (!cell)
        cell = { _type: SLIDE_OBJECT_TYPES.tablecell };
      const cellOpts = cell.options || null;
      numCols += Number((cellOpts === null || cellOpts === void 0 ? void 0 : cellOpts.colspan) ? cellOpts.colspan : 1);
    });
    if (tableProps.verbose)
      console.log(`| numCols ......................................... = ${numCols}`);
  }
  if (!tablePropW && tableProps.colW) {
    tableCalcW = Array.isArray(tableProps.colW) ? tableProps.colW.reduce((p, n) => p + n) * EMU : tableProps.colW * numCols || 0;
    if (tableProps.verbose)
      console.log(`| tableCalcW ...................................... = ${tableCalcW / EMU}`);
  }
  {
    emuSlideTabW = tableCalcW || inch2Emu((tablePropX ? tablePropX / EMU : arrInchMargins[1]) + arrInchMargins[3]);
    if (tableProps.verbose)
      console.log(`| emuSlideTabW .................................... = ${(emuSlideTabW / EMU).toFixed(1)}`);
  }
  if (!tableProps.colW || !Array.isArray(tableProps.colW)) {
    if (tableProps.colW && !isNaN(Number(tableProps.colW))) {
      const arrColW = [];
      const firstRow = tableRows[0] || [];
      firstRow.forEach(() => arrColW.push(tableProps.colW));
      tableProps.colW = [];
      arrColW.forEach((val) => {
        if (Array.isArray(tableProps.colW))
          tableProps.colW.push(val);
      });
    } else {
      tableProps.colW = [];
      for (let iCol = 0; iCol < numCols; iCol++) {
        tableProps.colW.push(emuSlideTabW / EMU / numCols);
      }
    }
  }
  let newTableRowSlide = { rows: [] };
  tableRows.forEach((row, iRow) => {
    const rowCellLines = [];
    let maxCellMarTopEmu = 0;
    let maxCellMarBtmEmu = 0;
    let currTableRow = [];
    row.forEach((cell) => {
      var _a, _b, _c, _d;
      currTableRow.push({
        _type: SLIDE_OBJECT_TYPES.tablecell,
        text: [],
        options: cell.options
      });
      if (cell.options.margin && cell.options.margin[0] >= 1) {
        if (((_a = cell.options) === null || _a === void 0 ? void 0 : _a.margin) && cell.options.margin[0] && valToPts(cell.options.margin[0]) > maxCellMarTopEmu)
          maxCellMarTopEmu = valToPts(cell.options.margin[0]);
        else if ((tableProps === null || tableProps === void 0 ? void 0 : tableProps.margin) && tableProps.margin[0] && valToPts(tableProps.margin[0]) > maxCellMarTopEmu)
          maxCellMarTopEmu = valToPts(tableProps.margin[0]);
        if (((_b = cell.options) === null || _b === void 0 ? void 0 : _b.margin) && cell.options.margin[2] && valToPts(cell.options.margin[2]) > maxCellMarBtmEmu)
          maxCellMarBtmEmu = valToPts(cell.options.margin[2]);
        else if ((tableProps === null || tableProps === void 0 ? void 0 : tableProps.margin) && tableProps.margin[2] && valToPts(tableProps.margin[2]) > maxCellMarBtmEmu)
          maxCellMarBtmEmu = valToPts(tableProps.margin[2]);
      } else {
        if (((_c = cell.options) === null || _c === void 0 ? void 0 : _c.margin) && cell.options.margin[0] && inch2Emu(cell.options.margin[0]) > maxCellMarTopEmu)
          maxCellMarTopEmu = inch2Emu(cell.options.margin[0]);
        else if ((tableProps === null || tableProps === void 0 ? void 0 : tableProps.margin) && tableProps.margin[0] && inch2Emu(tableProps.margin[0]) > maxCellMarTopEmu)
          maxCellMarTopEmu = inch2Emu(tableProps.margin[0]);
        if (((_d = cell.options) === null || _d === void 0 ? void 0 : _d.margin) && cell.options.margin[2] && inch2Emu(cell.options.margin[2]) > maxCellMarBtmEmu)
          maxCellMarBtmEmu = inch2Emu(cell.options.margin[2]);
        else if ((tableProps === null || tableProps === void 0 ? void 0 : tableProps.margin) && tableProps.margin[2] && inch2Emu(tableProps.margin[2]) > maxCellMarBtmEmu)
          maxCellMarBtmEmu = inch2Emu(tableProps.margin[2]);
      }
    });
    calcSlideTabH();
    emuTabCurrH += maxCellMarTopEmu + maxCellMarBtmEmu;
    if (tableProps.verbose && iRow === 0)
      console.log(`| SLIDE [${tableRowSlides.length}]: emuSlideTabH ...... = ${(emuSlideTabH / EMU).toFixed(1)} `);
    row.forEach((cell, iCell) => {
      var _a;
      const newCell = {
        _type: SLIDE_OBJECT_TYPES.tablecell,
        _lines: null,
        _lineHeight: inch2Emu((((_a = cell.options) === null || _a === void 0 ? void 0 : _a.fontSize) ? cell.options.fontSize : tableProps.fontSize ? tableProps.fontSize : DEF_FONT_SIZE) * (LINEH_MODIFIER + (tableProps.autoPageLineWeight ? tableProps.autoPageLineWeight : 0)) / 100),
        text: [],
        options: cell.options
      };
      if (newCell.options.rowspan)
        newCell._lineHeight = 0;
      newCell.options.autoPageCharWeight = tableProps.autoPageCharWeight ? tableProps.autoPageCharWeight : null;
      let totalColW = tableProps.colW[iCell];
      if (cell.options.colspan && Array.isArray(tableProps.colW)) {
        totalColW = tableProps.colW.filter((_cell, idx) => idx >= iCell && idx < idx + cell.options.colspan).reduce((prev, curr) => prev + curr);
      }
      newCell._lines = parseTextToLines(cell, totalColW);
      rowCellLines.push(newCell);
    });
    if (tableProps.verbose)
      console.log(`
| SLIDE [${tableRowSlides.length}]: ROW [${iRow}]: START...`);
    let currCellIdx = 0;
    let emuLineMaxH = 0;
    let isDone = false;
    while (!isDone) {
      const srcCell = rowCellLines[currCellIdx];
      let tgtCell = currTableRow[currCellIdx];
      rowCellLines.forEach((cell) => {
        if (cell._lineHeight >= emuLineMaxH)
          emuLineMaxH = cell._lineHeight;
      });
      if (emuTabCurrH + emuLineMaxH > emuSlideTabH) {
        if (tableProps.verbose) {
          console.log("\n|-----------------------------------------------------------------------|");
          console.log(`|-- NEW SLIDE CREATED (currTabH+currLineH > maxH) => ${(emuTabCurrH / EMU).toFixed(2)} + ${(srcCell._lineHeight / EMU).toFixed(2)} > ${emuSlideTabH / EMU}`);
          console.log("|-----------------------------------------------------------------------|\n\n");
        }
        if (currTableRow.length > 0 && currTableRow.map((cell) => cell.text.length).reduce((p, n) => p + n) > 0)
          newTableRowSlide.rows.push(currTableRow);
        tableRowSlides.push(newTableRowSlide);
        const newRows = [];
        newTableRowSlide = { rows: newRows };
        currTableRow = [];
        row.forEach((cell) => currTableRow.push({ _type: SLIDE_OBJECT_TYPES.tablecell, text: [], options: cell.options }));
        calcSlideTabH();
        emuTabCurrH += maxCellMarTopEmu + maxCellMarBtmEmu;
        if (tableProps.verbose)
          console.log(`| SLIDE [${tableRowSlides.length}]: emuSlideTabH ...... = ${(emuSlideTabH / EMU).toFixed(1)} `);
        emuTabCurrH = 0;
        if ((tableProps.addHeaderToEach || tableProps.autoPageRepeatHeader) && tableProps._arrObjTabHeadRows) {
          tableProps._arrObjTabHeadRows.forEach((row2) => {
            const newHeadRow = [];
            let maxLineHeight = 0;
            row2.forEach((cell) => {
              newHeadRow.push(cell);
              if (cell._lineHeight > maxLineHeight)
                maxLineHeight = cell._lineHeight;
            });
            newTableRowSlide.rows.push(newHeadRow);
            emuTabCurrH += maxLineHeight;
          });
        }
        tgtCell = currTableRow[currCellIdx];
      }
      const currLine = srcCell._lines.shift();
      if (Array.isArray(tgtCell.text)) {
        if (currLine)
          tgtCell.text = tgtCell.text.concat(currLine);
        else if (tgtCell.text.length === 0)
          tgtCell.text = tgtCell.text.concat({ _type: SLIDE_OBJECT_TYPES.tablecell, text: "" });
      }
      if (currCellIdx === rowCellLines.length - 1)
        emuTabCurrH += emuLineMaxH;
      currCellIdx = currCellIdx < rowCellLines.length - 1 ? currCellIdx + 1 : 0;
      const brent = rowCellLines.map((cell) => cell._lines.length).reduce((prev, next) => prev + next);
      if (brent === 0)
        isDone = true;
    }
    if (currTableRow.length > 0)
      newTableRowSlide.rows.push(currTableRow);
    if (tableProps.verbose) {
      console.log(`- SLIDE [${tableRowSlides.length}]: ROW [${iRow}]: ...COMPLETE ...... emuTabCurrH = ${(emuTabCurrH / EMU).toFixed(2)} ( emuSlideTabH = ${(emuSlideTabH / EMU).toFixed(2)} )`);
    }
  });
  tableRowSlides.push(newTableRowSlide);
  if (tableProps.verbose) {
    console.log("\n|================================================|");
    console.log(`| FINAL: tableRowSlides.length = ${tableRowSlides.length}`);
    tableRowSlides.forEach((slide) => console.log(slide));
    console.log("|================================================|\n\n");
  }
  return tableRowSlides;
}
function genTableToSlides(pptx, tabEleId, options = {}, masterSlide) {
  const opts = options || {};
  opts.slideMargin = opts.slideMargin || opts.slideMargin === 0 ? opts.slideMargin : 0.5;
  let emuSlideTabW = opts.w || pptx.presLayout.width;
  const arrObjTabHeadRows = [];
  const arrObjTabBodyRows = [];
  const arrObjTabFootRows = [];
  const arrColW = [];
  const arrTabColW = [];
  let arrInchMargins = [0.5, 0.5, 0.5, 0.5];
  let intTabW = 0;
  if (!document.getElementById(tabEleId))
    throw new Error('tableToSlides: Table ID "' + tabEleId + '" does not exist!');
  if (masterSlide === null || masterSlide === void 0 ? void 0 : masterSlide._margin) {
    if (Array.isArray(masterSlide._margin))
      arrInchMargins = masterSlide._margin;
    else if (!isNaN(masterSlide._margin))
      arrInchMargins = [masterSlide._margin, masterSlide._margin, masterSlide._margin, masterSlide._margin];
    opts.slideMargin = arrInchMargins;
  } else if (opts === null || opts === void 0 ? void 0 : opts.slideMargin) {
    if (Array.isArray(opts.slideMargin))
      arrInchMargins = opts.slideMargin;
    else if (!isNaN(opts.slideMargin))
      arrInchMargins = [opts.slideMargin, opts.slideMargin, opts.slideMargin, opts.slideMargin];
  }
  emuSlideTabW = (opts.w ? inch2Emu(opts.w) : pptx.presLayout.width) - inch2Emu(arrInchMargins[1] + arrInchMargins[3]);
  if (opts.verbose) {
    console.log("[[VERBOSE MODE]]");
    console.log("|-- `tableToSlides` ----------------------------------------------------|");
    console.log(`| tableProps.h .................................... = ${opts.h}`);
    console.log(`| tableProps.w .................................... = ${opts.w}`);
    console.log(`| pptx.presLayout.width ........................... = ${(pptx.presLayout.width / EMU).toFixed(1)}`);
    console.log(`| pptx.presLayout.height .......................... = ${(pptx.presLayout.height / EMU).toFixed(1)}`);
    console.log(`| emuSlideTabW .................................... = ${(emuSlideTabW / EMU).toFixed(1)}`);
  }
  let firstRowCells = document.querySelectorAll(`#${tabEleId} tr:first-child th`);
  if (firstRowCells.length === 0)
    firstRowCells = document.querySelectorAll(`#${tabEleId} tr:first-child td`);
  firstRowCells.forEach((cellEle) => {
    const cell = cellEle;
    if (cell.getAttribute("colspan")) {
      for (let idxc = 0; idxc < Number(cell.getAttribute("colspan")); idxc++) {
        arrTabColW.push(Math.round(cell.offsetWidth / Number(cell.getAttribute("colspan"))));
      }
    } else {
      arrTabColW.push(cell.offsetWidth);
    }
  });
  arrTabColW.forEach((colW) => {
    intTabW += colW;
  });
  arrTabColW.forEach((colW, idxW) => {
    const intCalcWidth = Number((Number(emuSlideTabW) * (colW / intTabW * 100) / 100 / EMU).toFixed(2));
    let intMinWidth = 0;
    const colSelectorMin = document.querySelector(`#${tabEleId} thead tr:first-child th:nth-child(${idxW + 1})`);
    if (colSelectorMin)
      intMinWidth = Number(colSelectorMin.getAttribute("data-pptx-min-width"));
    const colSelectorSet = document.querySelector(`#${tabEleId} thead tr:first-child th:nth-child(${idxW + 1})`);
    if (colSelectorSet)
      intMinWidth = Number(colSelectorSet.getAttribute("data-pptx-width"));
    arrColW.push(intMinWidth > intCalcWidth ? intMinWidth : intCalcWidth);
  });
  if (opts.verbose) {
    console.log(`| arrColW ......................................... = [${arrColW.join(", ")}]`);
  }
  const tableParts = ["thead", "tbody", "tfoot"];
  tableParts.forEach((part) => {
    document.querySelectorAll(`#${tabEleId} ${part} tr`).forEach((row) => {
      const htmlRow = row;
      const arrObjTabCells = [];
      Array.from(htmlRow.cells).forEach((cell) => {
        const arrRGB1 = window.getComputedStyle(cell).getPropertyValue("color").replace(/\s+/gi, "").replace("rgba(", "").replace("rgb(", "").replace(")", "").split(",");
        let arrRGB2 = window.getComputedStyle(cell).getPropertyValue("background-color").replace(/\s+/gi, "").replace("rgba(", "").replace("rgb(", "").replace(")", "").split(",");
        if (
          // NOTE: (ISSUE#57): Default for unstyled tables is black bkgd, so use white instead
          window.getComputedStyle(cell).getPropertyValue("background-color") === "rgba(0, 0, 0, 0)" || window.getComputedStyle(cell).getPropertyValue("transparent")
        ) {
          arrRGB2 = ["255", "255", "255"];
        }
        const cellOpts = {
          align: null,
          bold: !!(window.getComputedStyle(cell).getPropertyValue("font-weight") === "bold" || Number(window.getComputedStyle(cell).getPropertyValue("font-weight")) >= 500),
          border: null,
          color: rgbToHex(Number(arrRGB1[0]), Number(arrRGB1[1]), Number(arrRGB1[2])),
          fill: { color: rgbToHex(Number(arrRGB2[0]), Number(arrRGB2[1]), Number(arrRGB2[2])) },
          fontFace: (window.getComputedStyle(cell).getPropertyValue("font-family") || "").split(",")[0].replace(/"/g, "").replace("inherit", "").replace("initial", "") || null,
          fontSize: Number(window.getComputedStyle(cell).getPropertyValue("font-size").replace(/[a-z]/gi, "")),
          margin: null,
          colspan: Number(cell.getAttribute("colspan")) || null,
          rowspan: Number(cell.getAttribute("rowspan")) || null,
          valign: null
        };
        if (["left", "center", "right", "start", "end"].includes(window.getComputedStyle(cell).getPropertyValue("text-align"))) {
          const align = window.getComputedStyle(cell).getPropertyValue("text-align").replace("start", "left").replace("end", "right");
          cellOpts.align = align === "center" ? "center" : align === "left" ? "left" : align === "right" ? "right" : null;
        }
        if (["top", "middle", "bottom"].includes(window.getComputedStyle(cell).getPropertyValue("vertical-align"))) {
          const valign = window.getComputedStyle(cell).getPropertyValue("vertical-align");
          cellOpts.valign = valign === "top" ? "top" : valign === "middle" ? "middle" : valign === "bottom" ? "bottom" : null;
        }
        if (window.getComputedStyle(cell).getPropertyValue("padding-left")) {
          cellOpts.margin = [0, 0, 0, 0];
          const sidesPad = ["padding-top", "padding-right", "padding-bottom", "padding-left"];
          sidesPad.forEach((val, idxs) => {
            cellOpts.margin[idxs] = Math.round(Number(window.getComputedStyle(cell).getPropertyValue(val).replace(/\D/gi, "")));
          });
        }
        if (window.getComputedStyle(cell).getPropertyValue("border-top-width") || window.getComputedStyle(cell).getPropertyValue("border-right-width") || window.getComputedStyle(cell).getPropertyValue("border-bottom-width") || window.getComputedStyle(cell).getPropertyValue("border-left-width")) {
          cellOpts.border = [null, null, null, null];
          const sidesBor = ["top", "right", "bottom", "left"];
          sidesBor.forEach((val, idxb) => {
            const intBorderW = Math.round(Number(window.getComputedStyle(cell).getPropertyValue("border-" + val + "-width").replace("px", "")));
            let arrRGB = [];
            arrRGB = window.getComputedStyle(cell).getPropertyValue("border-" + val + "-color").replace(/\s+/gi, "").replace("rgba(", "").replace("rgb(", "").replace(")", "").split(",");
            const strBorderC = rgbToHex(Number(arrRGB[0]), Number(arrRGB[1]), Number(arrRGB[2]));
            cellOpts.border[idxb] = { pt: intBorderW, color: strBorderC };
          });
        }
        arrObjTabCells.push({
          _type: SLIDE_OBJECT_TYPES.tablecell,
          text: cell.innerText,
          // `innerText` returns <br> as "\n", so linebreak etc. work later!
          options: cellOpts
        });
      });
      switch (part) {
        case "thead":
          arrObjTabHeadRows.push(arrObjTabCells);
          break;
        case "tbody":
          arrObjTabBodyRows.push(arrObjTabCells);
          break;
        case "tfoot":
          arrObjTabFootRows.push(arrObjTabCells);
          break;
        default:
          console.log(`table parsing: unexpected table part: ${part}`);
          break;
      }
    });
  });
  opts._arrObjTabHeadRows = arrObjTabHeadRows || null;
  opts.colW = arrColW;
  getSlidesForTableRows([...arrObjTabHeadRows, ...arrObjTabBodyRows, ...arrObjTabFootRows], opts, pptx.presLayout, masterSlide).forEach((slide, idxTr) => {
    const newSlide = pptx.addSlide({ masterName: opts.masterSlideName || null });
    if (idxTr === 0)
      opts.y = opts.y || arrInchMargins[0];
    if (idxTr > 0)
      opts.y = opts.autoPageSlideStartY || opts.newSlideStartY || arrInchMargins[0];
    if (opts.verbose)
      console.log(`| opts.autoPageSlideStartY: ${opts.autoPageSlideStartY} / arrInchMargins[0]: ${arrInchMargins[0]} => opts.y = ${opts.y}`);
    newSlide.addTable(slide.rows, { x: opts.x || arrInchMargins[3], y: opts.y, w: Number(emuSlideTabW) / EMU, colW: arrColW, autoPage: false });
    if (opts.addImage) {
      opts.addImage.options = opts.addImage.options || {};
      if (!opts.addImage.image || !opts.addImage.image.path && !opts.addImage.image.data) {
        console.warn("Warning: tableToSlides.addImage requires either `path` or `data`");
      } else {
        newSlide.addImage({
          path: opts.addImage.image.path,
          data: opts.addImage.image.data,
          x: opts.addImage.options.x,
          y: opts.addImage.options.y,
          w: opts.addImage.options.w,
          h: opts.addImage.options.h
        });
      }
    }
    if (opts.addShape)
      newSlide.addShape(opts.addShape.shapeName, opts.addShape.options || {});
    if (opts.addTable)
      newSlide.addTable(opts.addTable.rows, opts.addTable.options || {});
    if (opts.addText)
      newSlide.addText(opts.addText.text, opts.addText.options || {});
  });
}
var _chartCounter = 0;
function createSlideMaster(props, target) {
  if (props.bkgd)
    target.bkgd = props.bkgd;
  if (props.objects && Array.isArray(props.objects) && props.objects.length > 0) {
    props.objects.forEach((object, idx) => {
      const key = Object.keys(object)[0];
      const tgt = target;
      if (MASTER_OBJECTS[key] && key === "chart")
        addChartDefinition(tgt, object[key].type, object[key].data, object[key].opts);
      else if (MASTER_OBJECTS[key] && key === "image")
        addImageDefinition(tgt, object[key]);
      else if (MASTER_OBJECTS[key] && key === "line")
        addShapeDefinition(tgt, SHAPE_TYPE.LINE, object[key]);
      else if (MASTER_OBJECTS[key] && key === "rect")
        addShapeDefinition(tgt, SHAPE_TYPE.RECTANGLE, object[key]);
      else if (MASTER_OBJECTS[key] && key === "text")
        addTextDefinition(tgt, [{ text: object[key].text }], object[key].options, false);
      else if (MASTER_OBJECTS[key] && key === "placeholder") {
        object[key].options.placeholder = object[key].options.name;
        delete object[key].options.name;
        object[key].options._placeholderType = object[key].options.type;
        delete object[key].options.type;
        object[key].options._placeholderIdx = 100 + idx;
        addTextDefinition(tgt, [{ text: object[key].text }], object[key].options, true);
      }
    });
  }
  if (props.slideNumber && typeof props.slideNumber === "object")
    target._slideNumberProps = props.slideNumber;
}
function addChartDefinition(target, type, data, opt) {
  var _a;
  function correctGridLineOptions(glOpts) {
    if (!glOpts || glOpts.style === "none")
      return;
    if (glOpts.size !== void 0 && (isNaN(Number(glOpts.size)) || glOpts.size <= 0)) {
      console.warn("Warning: chart.gridLine.size must be greater than 0.");
      delete glOpts.size;
    }
    if (glOpts.style && !["solid", "dash", "dot"].includes(glOpts.style)) {
      console.warn("Warning: chart.gridLine.style options: `solid`, `dash`, `dot`.");
      delete glOpts.style;
    }
    if (glOpts.cap && !["flat", "square", "round"].includes(glOpts.cap)) {
      console.warn("Warning: chart.gridLine.cap options: `flat`, `square`, `round`.");
      delete glOpts.cap;
    }
  }
  const chartId = ++_chartCounter;
  const resultObject = {
    _type: null,
    text: null,
    options: null,
    chartRid: null
  };
  let tmpOpt = null;
  let tmpData = [];
  if (Array.isArray(type)) {
    type.forEach((obj) => {
      tmpData = tmpData.concat(obj.data);
    });
    tmpOpt = data || opt;
  } else {
    tmpData = data;
    tmpOpt = opt;
  }
  tmpData.forEach((item, i) => {
    item._dataIndex = i;
    if (item.labels !== void 0 && !Array.isArray(item.labels[0])) {
      item.labels = [item.labels];
    }
  });
  const options = tmpOpt && typeof tmpOpt === "object" ? tmpOpt : {};
  options._type = type;
  options.x = typeof options.x !== "undefined" && options.x != null && !isNaN(Number(options.x)) ? options.x : 1;
  options.y = typeof options.y !== "undefined" && options.y != null && !isNaN(Number(options.y)) ? options.y : 1;
  options.w = options.w || "50%";
  options.h = options.h || "50%";
  options.objectName = options.objectName ? encodeXmlEntities(options.objectName) : `Chart ${target._slideObjects.filter((obj) => obj._type === SLIDE_OBJECT_TYPES.chart).length}`;
  if (!["bar", "col"].includes(options.barDir || ""))
    options.barDir = "col";
  if (options._type === CHART_TYPE.AREA) {
    if (!["stacked", "standard", "percentStacked"].includes(options.barGrouping || ""))
      options.barGrouping = "standard";
  }
  if (options._type === CHART_TYPE.BAR) {
    if (!["clustered", "stacked", "percentStacked"].includes(options.barGrouping || ""))
      options.barGrouping = "clustered";
  }
  if (options._type === CHART_TYPE.BAR3D) {
    if (!["clustered", "stacked", "standard", "percentStacked"].includes(options.barGrouping || ""))
      options.barGrouping = "standard";
  }
  if ((_a = options.barGrouping) === null || _a === void 0 ? void 0 : _a.includes("tacked")) {
    if (!options.barGapWidthPct)
      options.barGapWidthPct = 50;
  }
  if (options.dataLabelPosition) {
    if (options._type === CHART_TYPE.AREA || options._type === CHART_TYPE.BAR3D || options._type === CHART_TYPE.DOUGHNUT || options._type === CHART_TYPE.RADAR) {
      delete options.dataLabelPosition;
    }
    if (options._type === CHART_TYPE.PIE) {
      if (!["bestFit", "ctr", "inEnd", "outEnd"].includes(options.dataLabelPosition))
        delete options.dataLabelPosition;
    }
    if (options._type === CHART_TYPE.BUBBLE || options._type === CHART_TYPE.BUBBLE3D || options._type === CHART_TYPE.LINE || options._type === CHART_TYPE.SCATTER) {
      if (!["b", "ctr", "l", "r", "t"].includes(options.dataLabelPosition))
        delete options.dataLabelPosition;
    }
    if (options._type === CHART_TYPE.BAR) {
      if (!["stacked", "percentStacked"].includes(options.barGrouping || "")) {
        if (!["ctr", "inBase", "inEnd"].includes(options.dataLabelPosition))
          delete options.dataLabelPosition;
      }
      if (!["clustered"].includes(options.barGrouping || "")) {
        if (!["ctr", "inBase", "inEnd", "outEnd"].includes(options.dataLabelPosition))
          delete options.dataLabelPosition;
      }
    }
  }
  options.dataLabelBkgrdColors = options.dataLabelBkgrdColors || !options.dataLabelBkgrdColors ? options.dataLabelBkgrdColors : false;
  if (!["b", "l", "r", "t", "tr"].includes(options.legendPos || ""))
    options.legendPos = "r";
  if (!["cone", "coneToMax", "box", "cylinder", "pyramid", "pyramidToMax"].includes(options.bar3DShape || ""))
    options.bar3DShape = "box";
  if (!["circle", "dash", "diamond", "dot", "none", "square", "triangle"].includes(options.lineDataSymbol || ""))
    options.lineDataSymbol = "circle";
  if (!["gap", "span"].includes(options.displayBlanksAs || ""))
    options.displayBlanksAs = "span";
  if (!["standard", "marker", "filled"].includes(options.radarStyle || ""))
    options.radarStyle = "standard";
  options.lineDataSymbolSize = options.lineDataSymbolSize && !isNaN(options.lineDataSymbolSize) ? options.lineDataSymbolSize : 6;
  options.lineDataSymbolLineSize = options.lineDataSymbolLineSize && !isNaN(options.lineDataSymbolLineSize) ? valToPts(options.lineDataSymbolLineSize) : valToPts(0.75);
  if (options.layout) {
    ["x", "y", "w", "h"].forEach((key) => {
      const val = options.layout[key];
      if (isNaN(Number(val)) || val < 0 || val > 1) {
        console.warn("Warning: chart.layout." + key + " can only be 0-1");
        delete options.layout[key];
      }
    });
  }
  options.catGridLine = options.catGridLine || (options._type === CHART_TYPE.SCATTER ? { color: "D9D9D9", size: 1 } : { style: "none" });
  options.valGridLine = options.valGridLine || (options._type === CHART_TYPE.SCATTER ? { color: "D9D9D9", size: 1 } : {});
  options.serGridLine = options.serGridLine || (options._type === CHART_TYPE.SCATTER ? { color: "D9D9D9", size: 1 } : { style: "none" });
  correctGridLineOptions(options.catGridLine);
  correctGridLineOptions(options.valGridLine);
  correctGridLineOptions(options.serGridLine);
  correctShadowOptions(options.shadow);
  options.showDataTable = options.showDataTable || !options.showDataTable ? options.showDataTable : false;
  options.showDataTableHorzBorder = options.showDataTableHorzBorder || !options.showDataTableHorzBorder ? options.showDataTableHorzBorder : true;
  options.showDataTableVertBorder = options.showDataTableVertBorder || !options.showDataTableVertBorder ? options.showDataTableVertBorder : true;
  options.showDataTableOutline = options.showDataTableOutline || !options.showDataTableOutline ? options.showDataTableOutline : true;
  options.showDataTableKeys = options.showDataTableKeys || !options.showDataTableKeys ? options.showDataTableKeys : true;
  options.showLabel = options.showLabel || !options.showLabel ? options.showLabel : false;
  options.showLegend = options.showLegend || !options.showLegend ? options.showLegend : false;
  options.showPercent = options.showPercent || !options.showPercent ? options.showPercent : true;
  options.showTitle = options.showTitle || !options.showTitle ? options.showTitle : false;
  options.showValue = options.showValue || !options.showValue ? options.showValue : false;
  options.showLeaderLines = options.showLeaderLines || !options.showLeaderLines ? options.showLeaderLines : false;
  options.catAxisLineShow = typeof options.catAxisLineShow !== "undefined" ? options.catAxisLineShow : true;
  options.valAxisLineShow = typeof options.valAxisLineShow !== "undefined" ? options.valAxisLineShow : true;
  options.serAxisLineShow = typeof options.serAxisLineShow !== "undefined" ? options.serAxisLineShow : true;
  options.v3DRotX = !isNaN(options.v3DRotX) && options.v3DRotX >= -90 && options.v3DRotX <= 90 ? options.v3DRotX : 30;
  options.v3DRotY = !isNaN(options.v3DRotY) && options.v3DRotY >= 0 && options.v3DRotY <= 360 ? options.v3DRotY : 30;
  options.v3DRAngAx = options.v3DRAngAx || !options.v3DRAngAx ? options.v3DRAngAx : true;
  options.v3DPerspective = !isNaN(options.v3DPerspective) && options.v3DPerspective >= 0 && options.v3DPerspective <= 240 ? options.v3DPerspective : 30;
  options.barGapWidthPct = !isNaN(options.barGapWidthPct) && options.barGapWidthPct >= 0 && options.barGapWidthPct <= 1e3 ? options.barGapWidthPct : 150;
  options.barGapDepthPct = !isNaN(options.barGapDepthPct) && options.barGapDepthPct >= 0 && options.barGapDepthPct <= 1e3 ? options.barGapDepthPct : 150;
  options.chartColors = Array.isArray(options.chartColors) ? options.chartColors : options._type === CHART_TYPE.PIE || options._type === CHART_TYPE.DOUGHNUT ? PIECHART_COLORS : BARCHART_COLORS;
  options.chartColorsOpacity = options.chartColorsOpacity && !isNaN(options.chartColorsOpacity) ? options.chartColorsOpacity : null;
  options.border = options.border && typeof options.border === "object" ? options.border : null;
  if (options.border && (!options.border.pt || isNaN(options.border.pt)))
    options.border.pt = DEF_CHART_BORDER.pt;
  if (options.border && (!options.border.color || typeof options.border.color !== "string"))
    options.border.color = DEF_CHART_BORDER.color;
  options.plotArea = options.plotArea || {};
  options.plotArea.border = options.plotArea.border && typeof options.plotArea.border === "object" ? options.plotArea.border : null;
  if (options.plotArea.border && (!options.plotArea.border.pt || isNaN(options.plotArea.border.pt)))
    options.plotArea.border.pt = DEF_CHART_BORDER.pt;
  if (options.plotArea.border && (!options.plotArea.border.color || typeof options.plotArea.border.color !== "string")) {
    options.plotArea.border.color = DEF_CHART_BORDER.color;
  }
  if (options.border)
    options.plotArea.border = options.border;
  options.plotArea.fill = options.plotArea.fill || { color: null, transparency: null };
  if (options.fill)
    options.plotArea.fill.color = options.fill;
  options.chartArea = options.chartArea || {};
  options.chartArea.border = options.chartArea.border && typeof options.chartArea.border === "object" ? options.chartArea.border : null;
  if (options.chartArea.border) {
    options.chartArea.border = {
      color: options.chartArea.border.color || DEF_CHART_BORDER.color,
      pt: options.chartArea.border.pt || DEF_CHART_BORDER.pt
    };
  }
  options.chartArea.roundedCorners = typeof options.chartArea.roundedCorners === "boolean" ? options.chartArea.roundedCorners : true;
  options.dataBorder = options.dataBorder && typeof options.dataBorder === "object" ? options.dataBorder : null;
  if (options.dataBorder && (!options.dataBorder.pt || isNaN(options.dataBorder.pt)))
    options.dataBorder.pt = 0.75;
  if (options.dataBorder && options.dataBorder.color) {
    const isHexColor = typeof options.dataBorder.color === "string" && options.dataBorder.color.length === 6 && /^[0-9A-Fa-f]{6}$/.test(options.dataBorder.color);
    const isSchemeColor = Object.values(SCHEME_COLOR_NAMES).includes(options.dataBorder.color);
    if (!isHexColor && !isSchemeColor) {
      options.dataBorder.color = "F9F9F9";
    }
  }
  if (!options.dataLabelFormatCode && options._type === CHART_TYPE.SCATTER)
    options.dataLabelFormatCode = "General";
  if (!options.dataLabelFormatCode && (options._type === CHART_TYPE.PIE || options._type === CHART_TYPE.DOUGHNUT)) {
    options.dataLabelFormatCode = options.showPercent ? "0%" : "General";
  }
  options.dataLabelFormatCode = options.dataLabelFormatCode && typeof options.dataLabelFormatCode === "string" ? options.dataLabelFormatCode : "#,##0";
  if (!options.dataLabelFormatScatter && options._type === CHART_TYPE.SCATTER)
    options.dataLabelFormatScatter = "custom";
  options.lineSize = typeof options.lineSize === "number" ? options.lineSize : 2;
  options.valAxisMajorUnit = typeof options.valAxisMajorUnit === "number" ? options.valAxisMajorUnit : null;
  if (options._type === CHART_TYPE.AREA || options._type === CHART_TYPE.BAR || options._type === CHART_TYPE.BAR3D || options._type === CHART_TYPE.LINE) {
    options.catAxisMultiLevelLabels = !!options.catAxisMultiLevelLabels;
  } else {
    delete options.catAxisMultiLevelLabels;
  }
  resultObject._type = "chart";
  resultObject.options = options;
  resultObject.chartRid = getNewRelId(target);
  target._relsChart.push({
    rId: getNewRelId(target),
    data: tmpData,
    opts: options,
    type: options._type,
    globalId: chartId,
    fileName: `chart${chartId}.xml`,
    Target: `/ppt/charts/chart${chartId}.xml`
  });
  target._slideObjects.push(resultObject);
  return resultObject;
}
function addImageDefinition(target, opt) {
  const newObject = {
    _type: null,
    text: null,
    options: null,
    image: null,
    imageRid: null,
    hyperlink: null
  };
  const intPosX = opt.x || 0;
  const intPosY = opt.y || 0;
  const intWidth = opt.w || 0;
  const intHeight = opt.h || 0;
  const sizing = opt.sizing || null;
  const objHyperlink = opt.hyperlink || "";
  const strImageData = opt.data || "";
  const strImagePath = opt.path || "";
  let imageRelId = getNewRelId(target);
  const objectName = opt.objectName ? encodeXmlEntities(opt.objectName) : `Image ${target._slideObjects.filter((obj) => obj._type === SLIDE_OBJECT_TYPES.image).length}`;
  if (!strImagePath && !strImageData) {
    console.error("ERROR: addImage() requires either 'data' or 'path' parameter!");
    return null;
  } else if (strImagePath && typeof strImagePath !== "string") {
    console.error(`ERROR: addImage() 'path' should be a string, ex: {path:'/img/sample.png'} - you sent ${String(strImagePath)}`);
    return null;
  } else if (strImageData && typeof strImageData !== "string") {
    console.error(`ERROR: addImage() 'data' should be a string, ex: {data:'image/png;base64,NMP[...]'} - you sent ${String(strImageData)}`);
    return null;
  } else if (strImageData && typeof strImageData === "string" && !strImageData.toLowerCase().includes("base64,")) {
    console.error("ERROR: Image `data` value lacks a base64 header! Ex: 'image/png;base64,NMP[...]')");
    return null;
  }
  let strImgExtn = (strImagePath.substring(strImagePath.lastIndexOf("/") + 1).split("?")[0].split(".").pop().split("#")[0] || "png").toLowerCase();
  if (strImageData && /image\/(\w+);/.exec(strImageData) && /image\/(\w+);/.exec(strImageData).length > 0) {
    strImgExtn = /image\/(\w+);/.exec(strImageData)[1];
  } else if (strImageData === null || strImageData === void 0 ? void 0 : strImageData.toLowerCase().includes("image/svg+xml")) {
    strImgExtn = "svg";
  }
  newObject._type = SLIDE_OBJECT_TYPES.image;
  newObject.image = strImagePath || "preencoded.png";
  newObject.options = {
    x: intPosX || 0,
    y: intPosY || 0,
    w: intWidth || 1,
    h: intHeight || 1,
    altText: opt.altText || "",
    rounding: typeof opt.rounding === "boolean" ? opt.rounding : false,
    sizing,
    placeholder: opt.placeholder,
    rotate: opt.rotate || 0,
    flipV: opt.flipV || false,
    flipH: opt.flipH || false,
    transparency: opt.transparency || 0,
    objectName,
    shadow: correctShadowOptions(opt.shadow)
  };
  if (strImgExtn === "svg") {
    target._relsMedia.push({
      path: strImagePath || strImageData + "png",
      type: "image/png",
      extn: "png",
      data: strImageData || "",
      rId: imageRelId,
      Target: `../media/image-${target._slideNum}-${target._relsMedia.length + 1}.png`,
      isSvgPng: true,
      svgSize: { w: getSmartParseNumber(newObject.options.w, "X", target._presLayout), h: getSmartParseNumber(newObject.options.h, "Y", target._presLayout) }
    });
    newObject.imageRid = imageRelId;
    target._relsMedia.push({
      path: strImagePath || strImageData,
      type: "image/svg+xml",
      extn: strImgExtn,
      data: strImageData || "",
      rId: imageRelId + 1,
      Target: `../media/image-${target._slideNum}-${target._relsMedia.length + 1}.${strImgExtn}`
    });
    newObject.imageRid = imageRelId + 1;
  } else {
    const dupeItem = target._relsMedia.filter((item) => item.path && item.path === strImagePath && item.type === "image/" + strImgExtn && !item.isDuplicate)[0];
    target._relsMedia.push({
      path: strImagePath || "preencoded." + strImgExtn,
      type: "image/" + strImgExtn,
      extn: strImgExtn,
      data: strImageData || "",
      rId: imageRelId,
      isDuplicate: !!(dupeItem === null || dupeItem === void 0 ? void 0 : dupeItem.Target),
      Target: (dupeItem === null || dupeItem === void 0 ? void 0 : dupeItem.Target) ? dupeItem.Target : `../media/image-${target._slideNum}-${target._relsMedia.length + 1}.${strImgExtn}`
    });
    newObject.imageRid = imageRelId;
  }
  if (typeof objHyperlink === "object") {
    if (!objHyperlink.url && !objHyperlink.slide)
      throw new Error("ERROR: `hyperlink` option requires either: `url` or `slide`");
    else {
      imageRelId++;
      target._rels.push({
        type: SLIDE_OBJECT_TYPES.hyperlink,
        data: objHyperlink.slide ? "slide" : "dummy",
        rId: imageRelId,
        Target: objHyperlink.url || objHyperlink.slide.toString()
      });
      objHyperlink._rId = imageRelId;
      newObject.hyperlink = objHyperlink;
    }
  }
  target._slideObjects.push(newObject);
}
function addMediaDefinition(target, opt) {
  const intPosX = opt.x || 0;
  const intPosY = opt.y || 0;
  const intSizeX = opt.w || 2;
  const intSizeY = opt.h || 2;
  const strData = opt.data || "";
  const strLink = opt.link || "";
  const strPath = opt.path || "";
  const strType = opt.type || "audio";
  let strExtn = "";
  const strCover = opt.cover || IMG_PLAYBTN;
  const objectName = opt.objectName ? encodeXmlEntities(opt.objectName) : `Media ${target._slideObjects.filter((obj) => obj._type === SLIDE_OBJECT_TYPES.media).length}`;
  const slideData = { _type: SLIDE_OBJECT_TYPES.media };
  if (!strPath && !strData && strType !== "online") {
    throw new Error("addMedia() error: either `data` or `path` are required!");
  } else if (strData && !strData.toLowerCase().includes("base64,")) {
    throw new Error("addMedia() error: `data` value lacks a base64 header! Ex: 'video/mpeg;base64,NMP[...]')");
  } else if (!strCover.toLowerCase().includes("base64,")) {
    throw new Error("addMedia() error: `cover` value lacks a base64 header! Ex: 'data:image/png;base64,iV[...]')");
  }
  if (strType === "online" && !strLink) {
    throw new Error("addMedia() error: online videos require `link` value");
  }
  strExtn = opt.extn || (strData ? strData.split(";")[0].split("/")[1] : strPath.split(".").pop()) || "mp3";
  slideData.mtype = strType;
  slideData.media = strPath || "preencoded.mov";
  slideData.options = {};
  slideData.options.x = intPosX;
  slideData.options.y = intPosY;
  slideData.options.w = intSizeX;
  slideData.options.h = intSizeY;
  slideData.options.objectName = objectName;
  if (strType === "online") {
    const relId1 = getNewRelId(target);
    target._relsMedia.push({
      path: strPath || "preencoded" + strExtn,
      data: "dummy",
      type: "online",
      extn: strExtn,
      rId: relId1,
      Target: strLink
    });
    slideData.mediaRid = relId1;
    target._relsMedia.push({
      path: "preencoded.png",
      data: strCover,
      type: "image/png",
      extn: "png",
      rId: getNewRelId(target),
      Target: `../media/image-${target._slideNum}-${target._relsMedia.length + 1}.png`
    });
  } else {
    const dupeItem = target._relsMedia.filter((item) => item.path && item.path === strPath && item.type === strType + "/" + strExtn && !item.isDuplicate)[0];
    const relId1 = getNewRelId(target);
    target._relsMedia.push({
      path: strPath || "preencoded" + strExtn,
      type: strType + "/" + strExtn,
      extn: strExtn,
      data: strData || "",
      rId: relId1,
      isDuplicate: !!(dupeItem === null || dupeItem === void 0 ? void 0 : dupeItem.Target),
      Target: (dupeItem === null || dupeItem === void 0 ? void 0 : dupeItem.Target) ? dupeItem.Target : `../media/media-${target._slideNum}-${target._relsMedia.length + 1}.${strExtn}`
    });
    slideData.mediaRid = relId1;
    target._relsMedia.push({
      path: strPath || "preencoded" + strExtn,
      type: strType + "/" + strExtn,
      extn: strExtn,
      data: strData || "",
      rId: getNewRelId(target),
      isDuplicate: !!(dupeItem === null || dupeItem === void 0 ? void 0 : dupeItem.Target),
      Target: (dupeItem === null || dupeItem === void 0 ? void 0 : dupeItem.Target) ? dupeItem.Target : `../media/media-${target._slideNum}-${target._relsMedia.length + 0}.${strExtn}`
    });
    target._relsMedia.push({
      path: "preencoded.png",
      type: "image/png",
      extn: "png",
      data: strCover,
      rId: getNewRelId(target),
      Target: `../media/image-${target._slideNum}-${target._relsMedia.length + 1}.png`
    });
  }
  target._slideObjects.push(slideData);
}
function addNotesDefinition(target, notes) {
  target._slideObjects.push({
    _type: SLIDE_OBJECT_TYPES.notes,
    text: [{ text: notes }]
  });
}
function addShapeDefinition(target, shapeName, opts) {
  const options = typeof opts === "object" ? opts : {};
  options.line = options.line || { type: "none" };
  const newObject = {
    _type: SLIDE_OBJECT_TYPES.text,
    shape: shapeName || SHAPE_TYPE.RECTANGLE,
    options,
    text: null
  };
  if (!shapeName)
    throw new Error("Missing/Invalid shape parameter! Example: `addShape(pptxgen.shapes.LINE, {x:1, y:1, w:1, h:1});`");
  const newLineOpts = {
    type: options.line.type || "solid",
    color: options.line.color || DEF_SHAPE_LINE_COLOR,
    transparency: options.line.transparency || 0,
    width: options.line.width || 1,
    dashType: options.line.dashType || "solid",
    beginArrowType: options.line.beginArrowType || null,
    endArrowType: options.line.endArrowType || null
  };
  if (typeof options.line === "object" && options.line.type !== "none")
    options.line = newLineOpts;
  options.x = options.x || (options.x === 0 ? 0 : 1);
  options.y = options.y || (options.y === 0 ? 0 : 1);
  options.w = options.w || (options.w === 0 ? 0 : 1);
  options.h = options.h || (options.h === 0 ? 0 : 1);
  options.objectName = options.objectName ? encodeXmlEntities(options.objectName) : `Shape ${target._slideObjects.filter((obj) => obj._type === SLIDE_OBJECT_TYPES.text).length}`;
  if (typeof options.line === "string") {
    const tmpOpts = newLineOpts;
    tmpOpts.color = String(options.line);
    options.line = tmpOpts;
  }
  if (typeof options.lineSize === "number")
    options.line.width = options.lineSize;
  if (typeof options.lineDash === "string")
    options.line.dashType = options.lineDash;
  if (typeof options.lineHead === "string")
    options.line.beginArrowType = options.lineHead;
  if (typeof options.lineTail === "string")
    options.line.endArrowType = options.lineTail;
  createHyperlinkRels(target, newObject);
  target._slideObjects.push(newObject);
}
function addTableDefinition(target, tableRows, options, slideLayout, presLayout, addSlide, getSlide) {
  const slides = [target];
  const opt = options && typeof options === "object" ? options : {};
  opt.objectName = opt.objectName ? encodeXmlEntities(opt.objectName) : `Table ${target._slideObjects.filter((obj) => obj._type === SLIDE_OBJECT_TYPES.table).length}`;
  {
    if (tableRows === null || tableRows.length === 0 || !Array.isArray(tableRows)) {
      throw new Error("addTable: Array expected! EX: 'slide.addTable( [rows], {options} );' (https://gitbrent.github.io/PptxGenJS/docs/api-tables.html)");
    }
    if (!tableRows[0] || !Array.isArray(tableRows[0])) {
      throw new Error("addTable: 'rows' should be an array of cells! EX: 'slide.addTable( [ ['A'], ['B'], {text:'C',options:{align:'center'}} ] );' (https://gitbrent.github.io/PptxGenJS/docs/api-tables.html)");
    }
  }
  const arrRows = [];
  tableRows.forEach((row) => {
    const newRow = [];
    if (Array.isArray(row)) {
      row.forEach((cell) => {
        const newCell = {
          _type: SLIDE_OBJECT_TYPES.tablecell,
          text: "",
          options: typeof cell === "object" && cell.options ? cell.options : {}
        };
        if (typeof cell === "string" || typeof cell === "number")
          newCell.text = cell.toString();
        else if (cell.text) {
          if (typeof cell.text === "string" || typeof cell.text === "number")
            newCell.text = cell.text.toString();
          else if (cell.text)
            newCell.text = cell.text;
          if (cell.options && typeof cell.options === "object")
            newCell.options = cell.options;
        }
        newCell.options.border = newCell.options.border || opt.border || [{ type: "none" }, { type: "none" }, { type: "none" }, { type: "none" }];
        const cellBorder = newCell.options.border;
        if (!Array.isArray(cellBorder) && typeof cellBorder === "object")
          newCell.options.border = [cellBorder, cellBorder, cellBorder, cellBorder];
        if (!newCell.options.border[0])
          newCell.options.border[0] = { type: "none" };
        if (!newCell.options.border[1])
          newCell.options.border[1] = { type: "none" };
        if (!newCell.options.border[2])
          newCell.options.border[2] = { type: "none" };
        if (!newCell.options.border[3])
          newCell.options.border[3] = { type: "none" };
        const arrSides = [0, 1, 2, 3];
        arrSides.forEach((idx) => {
          newCell.options.border[idx] = {
            type: newCell.options.border[idx].type || DEF_CELL_BORDER.type,
            color: newCell.options.border[idx].color || DEF_CELL_BORDER.color,
            pt: typeof newCell.options.border[idx].pt === "number" ? newCell.options.border[idx].pt : DEF_CELL_BORDER.pt
          };
        });
        newRow.push(newCell);
      });
    } else {
      console.log("addTable: tableRows has a bad row. A row should be an array of cells. You provided:");
      console.log(row);
    }
    arrRows.push(newRow);
  });
  opt.x = getSmartParseNumber(opt.x || (opt.x === 0 ? 0 : EMU / 2), "X", presLayout);
  opt.y = getSmartParseNumber(opt.y || (opt.y === 0 ? 0 : EMU / 2), "Y", presLayout);
  if (opt.h)
    opt.h = getSmartParseNumber(opt.h, "Y", presLayout);
  opt.fontSize = opt.fontSize || DEF_FONT_SIZE;
  opt.margin = opt.margin === 0 || opt.margin ? opt.margin : DEF_CELL_MARGIN_IN;
  if (typeof opt.margin === "number")
    opt.margin = [Number(opt.margin), Number(opt.margin), Number(opt.margin), Number(opt.margin)];
  if (JSON.stringify({ arrRows }).indexOf("hyperlink") === -1) {
    if (!opt.color)
      opt.color = opt.color || DEF_FONT_COLOR;
  }
  if (typeof opt.border === "string") {
    console.warn("addTable `border` option must be an object. Ex: `{border: {type:'none'}}`");
    opt.border = null;
  } else if (Array.isArray(opt.border)) {
    [0, 1, 2, 3].forEach((idx) => {
      opt.border[idx] = opt.border[idx] ? { type: opt.border[idx].type || DEF_CELL_BORDER.type, color: opt.border[idx].color || DEF_CELL_BORDER.color, pt: opt.border[idx].pt || DEF_CELL_BORDER.pt } : { type: "none" };
    });
  }
  opt.autoPage = typeof opt.autoPage === "boolean" ? opt.autoPage : false;
  opt.autoPageRepeatHeader = typeof opt.autoPageRepeatHeader === "boolean" ? opt.autoPageRepeatHeader : false;
  opt.autoPageHeaderRows = typeof opt.autoPageHeaderRows !== "undefined" && !isNaN(Number(opt.autoPageHeaderRows)) ? Number(opt.autoPageHeaderRows) : 1;
  opt.autoPageLineWeight = typeof opt.autoPageLineWeight !== "undefined" && !isNaN(Number(opt.autoPageLineWeight)) ? Number(opt.autoPageLineWeight) : 0;
  if (opt.autoPageLineWeight) {
    if (opt.autoPageLineWeight > 1)
      opt.autoPageLineWeight = 1;
    else if (opt.autoPageLineWeight < -1)
      opt.autoPageLineWeight = -1;
  }
  let arrTableMargin = DEF_SLIDE_MARGIN_IN;
  if (slideLayout && typeof slideLayout._margin !== "undefined") {
    if (Array.isArray(slideLayout._margin))
      arrTableMargin = slideLayout._margin;
    else if (!isNaN(Number(slideLayout._margin))) {
      arrTableMargin = [Number(slideLayout._margin), Number(slideLayout._margin), Number(slideLayout._margin), Number(slideLayout._margin)];
    }
  }
  if (opt.colW) {
    const firstRowColCnt = arrRows[0].reduce((totalLen, c) => {
      var _a;
      if (((_a = c === null || c === void 0 ? void 0 : c.options) === null || _a === void 0 ? void 0 : _a.colspan) && typeof c.options.colspan === "number") {
        totalLen += c.options.colspan;
      } else {
        totalLen += 1;
      }
      return totalLen;
    }, 0);
    if (typeof opt.colW === "string" || typeof opt.colW === "number") {
      opt.w = Math.floor(Number(opt.colW) * firstRowColCnt);
      opt.colW = null;
    } else if (opt.colW && Array.isArray(opt.colW) && opt.colW.length === 1 && firstRowColCnt > 1) {
      opt.w = Math.floor(Number(opt.colW) * firstRowColCnt);
      opt.colW = null;
    } else if (opt.colW && Array.isArray(opt.colW) && opt.colW.length !== firstRowColCnt) {
      console.warn("addTable: mismatch: (colW.length != data.length) Therefore, defaulting to evenly distributed col widths.");
      opt.colW = null;
    }
  } else if (opt.w) {
    opt.w = getSmartParseNumber(opt.w, "X", presLayout);
  } else {
    opt.w = Math.floor(presLayout._sizeW / EMU - arrTableMargin[1] - arrTableMargin[3]);
  }
  if (opt.x && opt.x < 20)
    opt.x = inch2Emu(opt.x);
  if (opt.y && opt.y < 20)
    opt.y = inch2Emu(opt.y);
  if (opt.w && typeof opt.w === "number" && opt.w < 20)
    opt.w = inch2Emu(opt.w);
  if (opt.h && typeof opt.h === "number" && opt.h < 20)
    opt.h = inch2Emu(opt.h);
  arrRows.forEach((row) => {
    row.forEach((cell, idy) => {
      if (typeof cell === "number" || typeof cell === "string") {
        row[idy] = { _type: SLIDE_OBJECT_TYPES.tablecell, text: String(row[idy]), options: opt };
      } else if (typeof cell === "object") {
        if (typeof cell.text === "number")
          row[idy].text = row[idy].text.toString();
        else if (typeof cell.text === "undefined" || cell.text === null)
          row[idy].text = "";
        row[idy].options = cell.options || {};
        row[idy]._type = SLIDE_OBJECT_TYPES.tablecell;
      }
    });
  });
  const newAutoPagedSlides = [];
  if (opt && !opt.autoPage) {
    createHyperlinkRels(target, arrRows);
    target._slideObjects.push({
      _type: SLIDE_OBJECT_TYPES.table,
      arrTabRows: arrRows,
      options: Object.assign({}, opt)
    });
  } else {
    if (opt.autoPageRepeatHeader)
      opt._arrObjTabHeadRows = arrRows.filter((_row, idx) => idx < opt.autoPageHeaderRows);
    getSlidesForTableRows(arrRows, opt, presLayout, slideLayout).forEach((slide, idx) => {
      if (!getSlide(target._slideNum + idx))
        slides.push(addSlide({ masterName: (slideLayout === null || slideLayout === void 0 ? void 0 : slideLayout._name) || null }));
      if (idx > 0)
        opt.y = inch2Emu(opt.autoPageSlideStartY || opt.newSlideStartY || arrTableMargin[0]);
      {
        const newSlide = getSlide(target._slideNum + idx);
        opt.autoPage = false;
        createHyperlinkRels(newSlide, slide.rows);
        newSlide.addTable(slide.rows, Object.assign({}, opt));
        if (idx > 0)
          newAutoPagedSlides.push(newSlide);
      }
    });
  }
  return newAutoPagedSlides;
}
function addTextDefinition(target, text, opts, isPlaceholder) {
  const newObject = {
    _type: isPlaceholder ? SLIDE_OBJECT_TYPES.placeholder : SLIDE_OBJECT_TYPES.text,
    shape: (opts === null || opts === void 0 ? void 0 : opts.shape) || SHAPE_TYPE.RECTANGLE,
    text: !text || text.length === 0 ? [{ text: "", options: null }] : text,
    options: opts || {}
  };
  function cleanOpts(itemOpts) {
    {
      if (!itemOpts.placeholder) {
        itemOpts.color = itemOpts.color || newObject.options.color || target.color || DEF_FONT_COLOR;
      }
      if (itemOpts.placeholder || isPlaceholder) {
        itemOpts.bullet = itemOpts.bullet || false;
      }
      if (itemOpts.placeholder && target._slideLayout && target._slideLayout._slideObjects) {
        const placeHold = target._slideLayout._slideObjects.filter((item) => item._type === "placeholder" && item.options && item.options.placeholder && item.options.placeholder === itemOpts.placeholder)[0];
        if (placeHold === null || placeHold === void 0 ? void 0 : placeHold.options)
          itemOpts = Object.assign(Object.assign({}, itemOpts), placeHold.options);
      }
      itemOpts.objectName = itemOpts.objectName ? encodeXmlEntities(itemOpts.objectName) : `Text ${target._slideObjects.filter((obj) => obj._type === SLIDE_OBJECT_TYPES.text).length}`;
      if (itemOpts.shape === SHAPE_TYPE.LINE) {
        const newLineOpts = {
          type: itemOpts.line.type || "solid",
          color: itemOpts.line.color || DEF_SHAPE_LINE_COLOR,
          transparency: itemOpts.line.transparency || 0,
          width: itemOpts.line.width || 1,
          dashType: itemOpts.line.dashType || "solid",
          beginArrowType: itemOpts.line.beginArrowType || null,
          endArrowType: itemOpts.line.endArrowType || null
        };
        if (typeof itemOpts.line === "object")
          itemOpts.line = newLineOpts;
        if (typeof itemOpts.line === "string") {
          const tmpOpts = newLineOpts;
          if (typeof itemOpts.line === "string")
            tmpOpts.color = itemOpts.line;
          itemOpts.line = tmpOpts;
        }
        if (typeof itemOpts.lineSize === "number")
          itemOpts.line.width = itemOpts.lineSize;
        if (typeof itemOpts.lineDash === "string")
          itemOpts.line.dashType = itemOpts.lineDash;
        if (typeof itemOpts.lineHead === "string")
          itemOpts.line.beginArrowType = itemOpts.lineHead;
        if (typeof itemOpts.lineTail === "string")
          itemOpts.line.endArrowType = itemOpts.lineTail;
      }
      itemOpts.line = itemOpts.line || {};
      itemOpts.lineSpacing = itemOpts.lineSpacing && !isNaN(itemOpts.lineSpacing) ? itemOpts.lineSpacing : null;
      itemOpts.lineSpacingMultiple = itemOpts.lineSpacingMultiple && !isNaN(itemOpts.lineSpacingMultiple) ? itemOpts.lineSpacingMultiple : null;
      itemOpts._bodyProp = itemOpts._bodyProp || {};
      itemOpts._bodyProp.autoFit = itemOpts.autoFit || false;
      itemOpts._bodyProp.anchor = !itemOpts.placeholder ? TEXT_VALIGN.ctr : null;
      itemOpts._bodyProp.vert = itemOpts.vert || null;
      itemOpts._bodyProp.wrap = typeof itemOpts.wrap === "boolean" ? itemOpts.wrap : true;
      if (itemOpts.inset && !isNaN(Number(itemOpts.inset)) || itemOpts.inset === 0) {
        itemOpts._bodyProp.lIns = inch2Emu(itemOpts.inset);
        itemOpts._bodyProp.rIns = inch2Emu(itemOpts.inset);
        itemOpts._bodyProp.tIns = inch2Emu(itemOpts.inset);
        itemOpts._bodyProp.bIns = inch2Emu(itemOpts.inset);
      }
      if (typeof itemOpts.underline === "boolean" && itemOpts.underline === true)
        itemOpts.underline = { style: "sng" };
    }
    {
      if ((itemOpts.align || "").toLowerCase().indexOf("c") === 0)
        itemOpts._bodyProp.align = TEXT_HALIGN.center;
      else if ((itemOpts.align || "").toLowerCase().indexOf("l") === 0)
        itemOpts._bodyProp.align = TEXT_HALIGN.left;
      else if ((itemOpts.align || "").toLowerCase().indexOf("r") === 0)
        itemOpts._bodyProp.align = TEXT_HALIGN.right;
      else if ((itemOpts.align || "").toLowerCase().indexOf("j") === 0)
        itemOpts._bodyProp.align = TEXT_HALIGN.justify;
      if ((itemOpts.valign || "").toLowerCase().indexOf("b") === 0)
        itemOpts._bodyProp.anchor = TEXT_VALIGN.b;
      else if ((itemOpts.valign || "").toLowerCase().indexOf("m") === 0)
        itemOpts._bodyProp.anchor = TEXT_VALIGN.ctr;
      else if ((itemOpts.valign || "").toLowerCase().indexOf("t") === 0)
        itemOpts._bodyProp.anchor = TEXT_VALIGN.t;
    }
    correctShadowOptions(itemOpts.shadow);
    return itemOpts;
  }
  newObject.options = cleanOpts(newObject.options);
  newObject.text.forEach((item) => item.options = cleanOpts(item.options || {}));
  createHyperlinkRels(target, newObject.text || "");
  target._slideObjects.push(newObject);
}
function addPlaceholdersToSlideLayouts(slide) {
  (slide._slideLayout._slideObjects || []).forEach((slideLayoutObj) => {
    if (slideLayoutObj._type === SLIDE_OBJECT_TYPES.placeholder) {
      if (slide._slideObjects.filter((slideObj) => slideObj.options && slideObj.options.placeholder === slideLayoutObj.options.placeholder).length === 0) {
        addTextDefinition(slide, [{ text: "" }], slideLayoutObj.options, false);
      }
    }
  });
}
function addBackgroundDefinition(props, target) {
  var _a;
  if (target.bkgd) {
    if (!target.background)
      target.background = {};
    if (typeof target.bkgd === "string")
      target.background.color = target.bkgd;
    else {
      if (target.bkgd.data)
        target.background.data = target.bkgd.data;
      if (target.bkgd.path)
        target.background.path = target.bkgd.path;
      if (target.bkgd.src)
        target.background.path = target.bkgd.src;
    }
  }
  if ((_a = target.background) === null || _a === void 0 ? void 0 : _a.fill)
    target.background.color = target.background.fill;
  if (props && (props.path || props.data)) {
    props.path = props.path || "preencoded.png";
    let strImgExtn = (props.path.split(".").pop() || "png").split("?")[0];
    if (strImgExtn === "jpg")
      strImgExtn = "jpeg";
    target._relsMedia = target._relsMedia || [];
    const intRels = target._relsMedia.length + 1;
    target._relsMedia.push({
      path: props.path,
      type: SLIDE_OBJECT_TYPES.image,
      extn: strImgExtn,
      data: props.data || null,
      rId: intRels,
      Target: `../media/${(target._name || "").replace(/\s+/gi, "-")}-image-${target._relsMedia.length + 1}.${strImgExtn}`
    });
    target._bkgdImgRid = intRels;
  }
}
function createHyperlinkRels(target, text, options) {
  let textObjs = [];
  if (typeof text === "string" || typeof text === "number")
    return;
  else if (Array.isArray(text))
    textObjs = text;
  else if (typeof text === "object")
    textObjs = [text];
  textObjs.forEach((text2, idx) => {
    if (options && options[idx] && options[idx].hyperlink)
      text2.options = Object.assign(Object.assign({}, text2.options), options[idx]);
    if (Array.isArray(text2)) {
      const cellOpts = [];
      text2.forEach((tablecell) => {
        if (tablecell.options && !tablecell.text.options) {
          cellOpts.push(tablecell.options);
        }
      });
      createHyperlinkRels(target, text2, cellOpts);
    } else if (Array.isArray(text2.text)) {
      createHyperlinkRels(target, text2.text, options && options[idx] ? [options[idx]] : void 0);
    } else if (text2 && typeof text2 === "object" && text2.options && text2.options.hyperlink && !text2.options.hyperlink._rId) {
      if (typeof text2.options.hyperlink !== "object") {
        console.log("ERROR: text `hyperlink` option should be an object. Ex: `hyperlink: {url:'https://github.com'}` ");
      } else if (!text2.options.hyperlink.url && !text2.options.hyperlink.slide) {
        console.log("ERROR: 'hyperlink requires either: `url` or `slide`'");
      } else {
        const relId = getNewRelId(target);
        target._rels.push({
          type: SLIDE_OBJECT_TYPES.hyperlink,
          data: text2.options.hyperlink.slide ? "slide" : "dummy",
          rId: relId,
          Target: encodeXmlEntities(text2.options.hyperlink.url) || text2.options.hyperlink.slide.toString()
        });
        text2.options.hyperlink._rId = relId;
      }
    } else if (text2 && typeof text2 === "object" && text2.options && text2.options.hyperlink && text2.options.hyperlink._rId) {
      if (target._rels.filter((rel) => rel.rId === text2.options.hyperlink._rId).length === 0) {
        target._rels.push({
          type: SLIDE_OBJECT_TYPES.hyperlink,
          data: text2.options.hyperlink.slide ? "slide" : "dummy",
          rId: text2.options.hyperlink._rId,
          Target: encodeXmlEntities(text2.options.hyperlink.url) || text2.options.hyperlink.slide.toString()
        });
      }
    }
  });
}
var Slide = class {
  constructor(params) {
    var _a;
    this.addSlide = params.addSlide;
    this.getSlide = params.getSlide;
    this._name = `Slide ${params.slideNumber}`;
    this._presLayout = params.presLayout;
    this._rId = params.slideRId;
    this._rels = [];
    this._relsChart = [];
    this._relsMedia = [];
    this._setSlideNum = params.setSlideNum;
    this._slideId = params.slideId;
    this._slideLayout = params.slideLayout || null;
    this._slideNum = params.slideNumber;
    this._slideObjects = [];
    this._slideNumberProps = ((_a = this._slideLayout) === null || _a === void 0 ? void 0 : _a._slideNumberProps) ? this._slideLayout._slideNumberProps : null;
  }
  set bkgd(value) {
    this._bkgd = value;
    if (!this._background || !this._background.color) {
      if (!this._background)
        this._background = {};
      if (typeof value === "string")
        this._background.color = value;
    }
  }
  get bkgd() {
    return this._bkgd;
  }
  set background(props) {
    this._background = props;
    if (props)
      addBackgroundDefinition(props, this);
  }
  get background() {
    return this._background;
  }
  set color(value) {
    this._color = value;
  }
  get color() {
    return this._color;
  }
  set hidden(value) {
    this._hidden = value;
  }
  get hidden() {
    return this._hidden;
  }
  /**
   * @type {SlideNumberProps}
   */
  set slideNumber(value) {
    this._slideNumberProps = value;
    this._setSlideNum(value);
  }
  get slideNumber() {
    return this._slideNumberProps;
  }
  get newAutoPagedSlides() {
    return this._newAutoPagedSlides;
  }
  /**
   * Add chart to Slide
   * @param {CHART_NAME|IChartMulti[]} type - chart type
   * @param {object[]} data - data object
   * @param {IChartOpts} options - chart options
   * @return {Slide} this Slide
   */
  addChart(type, data, options) {
    const optionsWithType = options || {};
    optionsWithType._type = type;
    addChartDefinition(this, type, data, options);
    return this;
  }
  /**
   * Add image to Slide
   * @param {ImageProps} options - image options
   * @return {Slide} this Slide
   */
  addImage(options) {
    addImageDefinition(this, options);
    return this;
  }
  /**
   * Add media (audio/video) to Slide
   * @param {MediaProps} options - media options
   * @return {Slide} this Slide
   */
  addMedia(options) {
    addMediaDefinition(this, options);
    return this;
  }
  /**
   * Add speaker notes to Slide
   * @docs https://gitbrent.github.io/PptxGenJS/docs/speaker-notes.html
   * @param {string} notes - notes to add to slide
   * @return {Slide} this Slide
   */
  addNotes(notes) {
    addNotesDefinition(this, notes);
    return this;
  }
  /**
   * Add shape to Slide
   * @param {SHAPE_NAME} shapeName - shape name
   * @param {ShapeProps} options - shape options
   * @return {Slide} this Slide
   */
  addShape(shapeName, options) {
    addShapeDefinition(this, shapeName, options);
    return this;
  }
  /**
   * Add table to Slide
   * @param {TableRow[]} tableRows - table rows
   * @param {TableProps} options - table options
   * @return {Slide} this Slide
   */
  addTable(tableRows, options) {
    this._newAutoPagedSlides = addTableDefinition(this, tableRows, options, this._slideLayout, this._presLayout, this.addSlide, this.getSlide);
    return this;
  }
  /**
   * Add text to Slide
   * @param {string|TextProps[]} text - text string or complex object
   * @param {TextPropsOptions} options - text options
   * @return {Slide} this Slide
   */
  addText(text, options) {
    const textParam = typeof text === "string" || typeof text === "number" ? [{ text, options }] : text;
    addTextDefinition(this, textParam, options, false);
    return this;
  }
};
function createExcelWorksheet(chartObject, zip) {
  return __awaiter(this, void 0, void 0, function* () {
    const data = chartObject.data;
    return yield new Promise((resolve, reject) => {
      var _a, _b;
      const zipExcel = new import_jszip.default();
      const intBubbleCols = (data.length - 1) * 2 + 1;
      const IS_MULTI_CAT_AXES = ((_b = (_a = data[0]) === null || _a === void 0 ? void 0 : _a.labels) === null || _b === void 0 ? void 0 : _b.length) > 1;
      zipExcel.folder("_rels");
      zipExcel.folder("docProps");
      zipExcel.folder("xl/_rels");
      zipExcel.folder("xl/tables");
      zipExcel.folder("xl/theme");
      zipExcel.folder("xl/worksheets");
      zipExcel.folder("xl/worksheets/_rels");
      {
        zipExcel.file("[Content_Types].xml", '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">  <Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>  <Default Extension="xml" ContentType="application/xml"/>  <Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/>  <Override PartName="/xl/worksheets/sheet1.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>  <Override PartName="/xl/theme/theme1.xml" ContentType="application/vnd.openxmlformats-officedocument.theme+xml"/>  <Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/>  <Override PartName="/xl/sharedStrings.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sharedStrings+xml"/>  <Override PartName="/xl/tables/table1.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.table+xml"/>  <Override PartName="/docProps/core.xml" ContentType="application/vnd.openxmlformats-package.core-properties+xml"/>  <Override PartName="/docProps/app.xml" ContentType="application/vnd.openxmlformats-officedocument.extended-properties+xml"/></Types>\n');
        zipExcel.file("_rels/.rels", '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/package/2006/relationships/metadata/core-properties" Target="docProps/core.xml"/><Relationship Id="rId2" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/extended-properties" Target="docProps/app.xml"/><Relationship Id="rId3" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/></Relationships>\n');
        zipExcel.file("docProps/app.xml", '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Properties xmlns="http://schemas.openxmlformats.org/officeDocument/2006/extended-properties" xmlns:vt="http://schemas.openxmlformats.org/officeDocument/2006/docPropsVTypes"><Application>Microsoft Macintosh Excel</Application><DocSecurity>0</DocSecurity><ScaleCrop>false</ScaleCrop><HeadingPairs><vt:vector size="2" baseType="variant"><vt:variant><vt:lpstr>Worksheets</vt:lpstr></vt:variant><vt:variant><vt:i4>1</vt:i4></vt:variant></vt:vector></HeadingPairs><TitlesOfParts><vt:vector size="1" baseType="lpstr"><vt:lpstr>Sheet1</vt:lpstr></vt:vector></TitlesOfParts><Company></Company><LinksUpToDate>false</LinksUpToDate><SharedDoc>false</SharedDoc><HyperlinksChanged>false</HyperlinksChanged><AppVersion>16.0300</AppVersion></Properties>\n');
        zipExcel.file("docProps/core.xml", '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><cp:coreProperties xmlns:cp="http://schemas.openxmlformats.org/package/2006/metadata/core-properties" xmlns:dc="http://purl.org/dc/elements/1.1/" xmlns:dcterms="http://purl.org/dc/terms/" xmlns:dcmitype="http://purl.org/dc/dcmitype/" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"><dc:creator>PptxGenJS</dc:creator><cp:lastModifiedBy>PptxGenJS</cp:lastModifiedBy><dcterms:created xsi:type="dcterms:W3CDTF">' + (/* @__PURE__ */ new Date()).toISOString() + '</dcterms:created><dcterms:modified xsi:type="dcterms:W3CDTF">' + (/* @__PURE__ */ new Date()).toISOString() + "</dcterms:modified></cp:coreProperties>");
        zipExcel.file("xl/_rels/workbook.xml.rels", '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId3" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/><Relationship Id="rId2" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/theme" Target="theme/theme1.xml"/><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet1.xml"/><Relationship Id="rId4" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/sharedStrings" Target="sharedStrings.xml"/></Relationships>');
        zipExcel.file("xl/styles.xml", '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><styleSheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><numFmts count="1"><numFmt numFmtId="0" formatCode="General"/></numFmts><fonts count="4"><font><sz val="9"/><color indexed="8"/><name val="Geneva"/></font><font><sz val="9"/><color indexed="8"/><name val="Geneva"/></font><font><sz val="10"/><color indexed="8"/><name val="Geneva"/></font><font><sz val="18"/><color indexed="8"/><name val="Arial"/></font></fonts><fills count="2"><fill><patternFill patternType="none"/></fill><fill><patternFill patternType="gray125"/></fill></fills><borders count="1"><border><left/><right/><top/><bottom/><diagonal/></border></borders><dxfs count="0"/><tableStyles count="0"/><colors><indexedColors><rgbColor rgb="ff000000"/><rgbColor rgb="ffffffff"/><rgbColor rgb="ffff0000"/><rgbColor rgb="ff00ff00"/><rgbColor rgb="ff0000ff"/><rgbColor rgb="ffffff00"/><rgbColor rgb="ffff00ff"/><rgbColor rgb="ff00ffff"/><rgbColor rgb="ff000000"/><rgbColor rgb="ffffffff"/><rgbColor rgb="ff878787"/><rgbColor rgb="fff9f9f9"/></indexedColors></colors></styleSheet>\n');
        zipExcel.file("xl/theme/theme1.xml", '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><a:theme xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main" name="Office Theme"><a:themeElements><a:clrScheme name="Office"><a:dk1><a:sysClr val="windowText" lastClr="000000"/></a:dk1><a:lt1><a:sysClr val="window" lastClr="FFFFFF"/></a:lt1><a:dk2><a:srgbClr val="44546A"/></a:dk2><a:lt2><a:srgbClr val="E7E6E6"/></a:lt2><a:accent1><a:srgbClr val="4472C4"/></a:accent1><a:accent2><a:srgbClr val="ED7D31"/></a:accent2><a:accent3><a:srgbClr val="A5A5A5"/></a:accent3><a:accent4><a:srgbClr val="FFC000"/></a:accent4><a:accent5><a:srgbClr val="5B9BD5"/></a:accent5><a:accent6><a:srgbClr val="70AD47"/></a:accent6><a:hlink><a:srgbClr val="0563C1"/></a:hlink><a:folHlink><a:srgbClr val="954F72"/></a:folHlink></a:clrScheme><a:fontScheme name="Office"><a:majorFont><a:latin typeface="Calibri Light" panose="020F0302020204030204"/><a:ea typeface=""/><a:cs typeface=""/><a:font script="Jpan" typeface="Yu Gothic Light"/><a:font script="Hang" typeface="\uB9D1\uC740 \uACE0\uB515"/><a:font script="Hans" typeface="DengXian Light"/><a:font script="Hant" typeface="\u65B0\u7D30\u660E\u9AD4"/><a:font script="Arab" typeface="Times New Roman"/><a:font script="Hebr" typeface="Times New Roman"/><a:font script="Thai" typeface="Tahoma"/><a:font script="Ethi" typeface="Nyala"/><a:font script="Beng" typeface="Vrinda"/><a:font script="Gujr" typeface="Shruti"/><a:font script="Khmr" typeface="MoolBoran"/><a:font script="Knda" typeface="Tunga"/><a:font script="Guru" typeface="Raavi"/><a:font script="Cans" typeface="Euphemia"/><a:font script="Cher" typeface="Plantagenet Cherokee"/><a:font script="Yiii" typeface="Microsoft Yi Baiti"/><a:font script="Tibt" typeface="Microsoft Himalaya"/><a:font script="Thaa" typeface="MV Boli"/><a:font script="Deva" typeface="Mangal"/><a:font script="Telu" typeface="Gautami"/><a:font script="Taml" typeface="Latha"/><a:font script="Syrc" typeface="Estrangelo Edessa"/><a:font script="Orya" typeface="Kalinga"/><a:font script="Mlym" typeface="Kartika"/><a:font script="Laoo" typeface="DokChampa"/><a:font script="Sinh" typeface="Iskoola Pota"/><a:font script="Mong" typeface="Mongolian Baiti"/><a:font script="Viet" typeface="Times New Roman"/><a:font script="Uigh" typeface="Microsoft Uighur"/><a:font script="Geor" typeface="Sylfaen"/></a:majorFont><a:minorFont><a:latin typeface="Calibri" panose="020F0502020204030204"/><a:ea typeface=""/><a:cs typeface=""/><a:font script="Jpan" typeface="Yu Gothic"/><a:font script="Hang" typeface="\uB9D1\uC740 \uACE0\uB515"/><a:font script="Hans" typeface="DengXian"/><a:font script="Hant" typeface="\u65B0\u7D30\u660E\u9AD4"/><a:font script="Arab" typeface="Arial"/><a:font script="Hebr" typeface="Arial"/><a:font script="Thai" typeface="Tahoma"/><a:font script="Ethi" typeface="Nyala"/><a:font script="Beng" typeface="Vrinda"/><a:font script="Gujr" typeface="Shruti"/><a:font script="Khmr" typeface="DaunPenh"/><a:font script="Knda" typeface="Tunga"/><a:font script="Guru" typeface="Raavi"/><a:font script="Cans" typeface="Euphemia"/><a:font script="Cher" typeface="Plantagenet Cherokee"/><a:font script="Yiii" typeface="Microsoft Yi Baiti"/><a:font script="Tibt" typeface="Microsoft Himalaya"/><a:font script="Thaa" typeface="MV Boli"/><a:font script="Deva" typeface="Mangal"/><a:font script="Telu" typeface="Gautami"/><a:font script="Taml" typeface="Latha"/><a:font script="Syrc" typeface="Estrangelo Edessa"/><a:font script="Orya" typeface="Kalinga"/><a:font script="Mlym" typeface="Kartika"/><a:font script="Laoo" typeface="DokChampa"/><a:font script="Sinh" typeface="Iskoola Pota"/><a:font script="Mong" typeface="Mongolian Baiti"/><a:font script="Viet" typeface="Arial"/><a:font script="Uigh" typeface="Microsoft Uighur"/><a:font script="Geor" typeface="Sylfaen"/></a:minorFont></a:fontScheme><a:fmtScheme name="Office"><a:fillStyleLst><a:solidFill><a:schemeClr val="phClr"/></a:solidFill><a:gradFill rotWithShape="1"><a:gsLst><a:gs pos="0"><a:schemeClr val="phClr"><a:lumMod val="110000"/><a:satMod val="105000"/><a:tint val="67000"/></a:schemeClr></a:gs><a:gs pos="50000"><a:schemeClr val="phClr"><a:lumMod val="105000"/><a:satMod val="103000"/><a:tint val="73000"/></a:schemeClr></a:gs><a:gs pos="100000"><a:schemeClr val="phClr"><a:lumMod val="105000"/><a:satMod val="109000"/><a:tint val="81000"/></a:schemeClr></a:gs></a:gsLst><a:lin ang="5400000" scaled="0"/></a:gradFill><a:gradFill rotWithShape="1"><a:gsLst><a:gs pos="0"><a:schemeClr val="phClr"><a:satMod val="103000"/><a:lumMod val="102000"/><a:tint val="94000"/></a:schemeClr></a:gs><a:gs pos="50000"><a:schemeClr val="phClr"><a:satMod val="110000"/><a:lumMod val="100000"/><a:shade val="100000"/></a:schemeClr></a:gs><a:gs pos="100000"><a:schemeClr val="phClr"><a:lumMod val="99000"/><a:satMod val="120000"/><a:shade val="78000"/></a:schemeClr></a:gs></a:gsLst><a:lin ang="5400000" scaled="0"/></a:gradFill></a:fillStyleLst><a:lnStyleLst><a:ln w="6350" cap="flat" cmpd="sng" algn="ctr"><a:solidFill><a:schemeClr val="phClr"/></a:solidFill><a:prstDash val="solid"/><a:miter lim="800000"/></a:ln><a:ln w="12700" cap="flat" cmpd="sng" algn="ctr"><a:solidFill><a:schemeClr val="phClr"/></a:solidFill><a:prstDash val="solid"/><a:miter lim="800000"/></a:ln><a:ln w="19050" cap="flat" cmpd="sng" algn="ctr"><a:solidFill><a:schemeClr val="phClr"/></a:solidFill><a:prstDash val="solid"/><a:miter lim="800000"/></a:ln></a:lnStyleLst><a:effectStyleLst><a:effectStyle><a:effectLst/></a:effectStyle><a:effectStyle><a:effectLst/></a:effectStyle><a:effectStyle><a:effectLst><a:outerShdw blurRad="57150" dist="19050" dir="5400000" algn="ctr" rotWithShape="0"><a:srgbClr val="000000"><a:alpha val="63000"/></a:srgbClr></a:outerShdw></a:effectLst></a:effectStyle></a:effectStyleLst><a:bgFillStyleLst><a:solidFill><a:schemeClr val="phClr"/></a:solidFill><a:solidFill><a:schemeClr val="phClr"><a:tint val="95000"/><a:satMod val="170000"/></a:schemeClr></a:solidFill><a:gradFill rotWithShape="1"><a:gsLst><a:gs pos="0"><a:schemeClr val="phClr"><a:tint val="93000"/><a:satMod val="150000"/><a:shade val="98000"/><a:lumMod val="102000"/></a:schemeClr></a:gs><a:gs pos="50000"><a:schemeClr val="phClr"><a:tint val="98000"/><a:satMod val="130000"/><a:shade val="90000"/><a:lumMod val="103000"/></a:schemeClr></a:gs><a:gs pos="100000"><a:schemeClr val="phClr"><a:shade val="63000"/><a:satMod val="120000"/></a:schemeClr></a:gs></a:gsLst><a:lin ang="5400000" scaled="0"/></a:gradFill></a:bgFillStyleLst></a:fmtScheme></a:themeElements><a:objectDefaults/><a:extraClrSchemeLst/><a:extLst><a:ext uri="{05A4C25C-085E-4340-85A3-A5531E510DB2}"><thm15:themeFamily xmlns:thm15="http://schemas.microsoft.com/office/thememl/2012/main" name="Office Theme" id="{62F939B6-93AF-4DB8-9C6B-D6C7DFDC589F}" vid="{4A3C46E8-61CC-4603-A589-7422A47A8E4A}"/></a:ext></a:extLst></a:theme>');
        zipExcel.file("xl/workbook.xml", '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships" xmlns:mc="http://schemas.openxmlformats.org/markup-compatibility/2006" mc:Ignorable="x15" xmlns:x15="http://schemas.microsoft.com/office/spreadsheetml/2010/11/main"><fileVersion appName="xl" lastEdited="7" lowestEdited="6" rupBuild="10507"/><workbookPr/><bookViews><workbookView xWindow="0" yWindow="500" windowWidth="20960" windowHeight="15960"/></bookViews><sheets><sheet name="Sheet1" sheetId="1" r:id="rId1"/></sheets><calcPr calcId="0" concurrentCalc="0"/></workbook>\n');
        zipExcel.file("xl/worksheets/_rels/sheet1.xml.rels", '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/table" Target="../tables/table1.xml"/></Relationships>\n');
      }
      {
        let strSharedStrings = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>';
        if (chartObject.opts._type === CHART_TYPE.BUBBLE || chartObject.opts._type === CHART_TYPE.BUBBLE3D) {
          strSharedStrings += `<sst xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" count="${intBubbleCols}" uniqueCount="${intBubbleCols}">`;
        } else if (chartObject.opts._type === CHART_TYPE.SCATTER) {
          strSharedStrings += `<sst xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" count="${data.length}" uniqueCount="${data.length}">`;
        } else if (IS_MULTI_CAT_AXES) {
          let totCount = data.length;
          data[0].labels.forEach((arrLabel) => totCount += arrLabel.filter((label) => label && label !== "").length);
          strSharedStrings += `<sst xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" count="${totCount}" uniqueCount="${totCount}">`;
          strSharedStrings += "<si><t/></si>";
        } else {
          const totCount = data.length + data[0].labels.length * data[0].labels[0].length + data[0].labels.length;
          const unqCount = data.length + data[0].labels.length * data[0].labels[0].length + 1;
          strSharedStrings += `<sst xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" count="${totCount}" uniqueCount="${unqCount}">`;
          strSharedStrings += '<si><t xml:space="preserve"></t></si>';
        }
        if (chartObject.opts._type === CHART_TYPE.BUBBLE || chartObject.opts._type === CHART_TYPE.BUBBLE3D) {
          data.forEach((objData, idx) => {
            if (idx === 0)
              strSharedStrings += "<si><t>X-Axis</t></si>";
            else {
              strSharedStrings += `<si><t>${encodeXmlEntities(objData.name || `Y-Axis${idx}`)}</t></si>`;
              strSharedStrings += `<si><t>${encodeXmlEntities(`Size${idx}`)}</t></si>`;
            }
          });
        } else {
          data.forEach((objData) => {
            strSharedStrings += `<si><t>${encodeXmlEntities((objData.name || " ").replace("X-Axis", "X-Values"))}</t></si>`;
          });
        }
        if (chartObject.opts._type !== CHART_TYPE.BUBBLE && chartObject.opts._type !== CHART_TYPE.BUBBLE3D && chartObject.opts._type !== CHART_TYPE.SCATTER) {
          data[0].labels.slice().reverse().forEach((labelsGroup) => {
            labelsGroup.filter((label) => label && label !== "").forEach((label) => {
              strSharedStrings += `<si><t>${encodeXmlEntities(label)}</t></si>`;
            });
          });
        }
        strSharedStrings += "</sst>\n";
        zipExcel.file("xl/sharedStrings.xml", strSharedStrings);
      }
      {
        let strTableXml = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>';
        if (chartObject.opts._type === CHART_TYPE.BUBBLE || chartObject.opts._type === CHART_TYPE.BUBBLE3D) {
          strTableXml += `<table xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" id="1" name="Table1" displayName="Table1" ref="A1:${getExcelColName(intBubbleCols)}${intBubbleCols}" totalsRowShown="0">`;
          strTableXml += `<tableColumns count="${intBubbleCols}">`;
          let idxColLtr = 1;
          data.forEach((obj, idx) => {
            if (idx === 0) {
              strTableXml += `<tableColumn id="${idx + 1}" name="X-Values"/>`;
            } else {
              strTableXml += `<tableColumn id="${idx + idxColLtr}" name="${obj.name}"/>`;
              idxColLtr++;
              strTableXml += `<tableColumn id="${idx + idxColLtr}" name="Size${idx}"/>`;
            }
          });
        } else if (chartObject.opts._type === CHART_TYPE.SCATTER) {
          strTableXml += `<table xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" id="1" name="Table1" displayName="Table1" ref="A1:${getExcelColName(data.length)}${data[0].values.length + 1}" totalsRowShown="0">`;
          strTableXml += `<tableColumns count="${data.length}">`;
          data.forEach((_obj, idx) => {
            strTableXml += `<tableColumn id="${idx + 1}" name="${idx === 0 ? "X-Values" : "Y-Value "}${idx}"/>`;
          });
        } else {
          strTableXml += `<table xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" id="1" name="Table1" displayName="Table1" ref="A1:${getExcelColName(data.length + data[0].labels.length)}${data[0].labels[0].length + 1}'" totalsRowShown="0">`;
          strTableXml += `<tableColumns count="${data.length + data[0].labels.length}">`;
          data[0].labels.forEach((_labelsGroup, idx) => {
            strTableXml += `<tableColumn id="${idx + 1}" name="Column${idx + 1}"/>`;
          });
          data.forEach((obj, idx) => {
            strTableXml += `<tableColumn id="${idx + data[0].labels.length + 1}" name="${encodeXmlEntities(obj.name)}"/>`;
          });
        }
        strTableXml += "</tableColumns>";
        strTableXml += '<tableStyleInfo showFirstColumn="0" showLastColumn="0" showRowStripes="1" showColumnStripes="0"/>';
        strTableXml += "</table>";
        zipExcel.file("xl/tables/table1.xml", strTableXml);
      }
      {
        let strSheetXml = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>';
        strSheetXml += '<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships" xmlns:mc="http://schemas.openxmlformats.org/markup-compatibility/2006" mc:Ignorable="x14ac" xmlns:x14ac="http://schemas.microsoft.com/office/spreadsheetml/2009/9/ac">';
        if (chartObject.opts._type === CHART_TYPE.BUBBLE || chartObject.opts._type === CHART_TYPE.BUBBLE3D) {
          strSheetXml += `<dimension ref="A1:${getExcelColName(intBubbleCols)}${data[0].values.length + 1}"/>`;
        } else if (chartObject.opts._type === CHART_TYPE.SCATTER) {
          strSheetXml += `<dimension ref="A1:${getExcelColName(data.length)}${data[0].values.length + 1}"/>`;
        } else {
          strSheetXml += `<dimension ref="A1:${getExcelColName(data.length + 1)}${data[0].values.length + 1}"/>`;
        }
        strSheetXml += '<sheetViews><sheetView tabSelected="1" workbookViewId="0"><selection activeCell="B1" sqref="B1"/></sheetView></sheetViews>';
        strSheetXml += '<sheetFormatPr baseColWidth="10" defaultRowHeight="16"/>';
        if (chartObject.opts._type === CHART_TYPE.BUBBLE || chartObject.opts._type === CHART_TYPE.BUBBLE3D) {
          strSheetXml += "<sheetData>";
          strSheetXml += `<row r="1" spans="1:${intBubbleCols}">`;
          strSheetXml += '<c r="A1" t="s"><v>0</v></c>';
          for (let idx = 1; idx < intBubbleCols; idx++) {
            strSheetXml += `<c r="${getExcelColName(idx + 1)}1" t="s"><v>${idx}</v></c>`;
          }
          strSheetXml += "</row>";
          data[0].values.forEach((val, idx) => {
            strSheetXml += `<row r="${idx + 2}" spans="1:${intBubbleCols}">`;
            strSheetXml += `<c r="A${idx + 2}"><v>${val}</v></c>`;
            let idxColLtr = 2;
            for (let idy = 1; idy < data.length; idy++) {
              strSheetXml += `<c r="${getExcelColName(idxColLtr)}${idx + 2}"><v>${data[idy].values[idx] || ""}</v></c>`;
              idxColLtr++;
              strSheetXml += `<c r="${getExcelColName(idxColLtr)}${idx + 2}"><v>${data[idy].sizes[idx] || ""}</v></c>`;
              idxColLtr++;
            }
            strSheetXml += "</row>";
          });
        } else if (chartObject.opts._type === CHART_TYPE.SCATTER) {
          strSheetXml += "<sheetData>";
          strSheetXml += `<row r="1" spans="1:${data.length}">`;
          for (let idx = 0; idx < data.length; idx++) {
            strSheetXml += `<c r="${getExcelColName(idx + 1)}1" t="s"><v>${idx}</v></c>`;
          }
          strSheetXml += "</row>";
          data[0].values.forEach((val, idx) => {
            strSheetXml += `<row r="${idx + 2}" spans="1:${data.length}">`;
            strSheetXml += `<c r="A${idx + 2}"><v>${val}</v></c>`;
            for (let idy = 1; idy < data.length; idy++) {
              strSheetXml += `<c r="${getExcelColName(idy + 1)}${idx + 2}"><v>${data[idy].values[idx] || data[idy].values[idx] === 0 ? data[idy].values[idx] : ""}</v></c>`;
            }
            strSheetXml += "</row>";
          });
        } else {
          strSheetXml += "<sheetData>";
          if (!IS_MULTI_CAT_AXES) {
            strSheetXml += `<row r="1" spans="1:${data.length + data[0].labels.length}">`;
            data[0].labels.forEach((_labelsGroup, idx) => {
              strSheetXml += `<c r="${getExcelColName(idx + 1)}1" t="s"><v>0</v></c>`;
            });
            for (let idx = 0; idx < data.length; idx++) {
              strSheetXml += `<c r="${getExcelColName(idx + 1 + data[0].labels.length)}1" t="s"><v>${idx + 1}</v></c>`;
            }
            strSheetXml += "</row>";
            data[0].labels[0].forEach((_cat, idx) => {
              strSheetXml += `<row r="${idx + 2}" spans="1:${data.length + data[0].labels.length}">`;
              for (let idx2 = data[0].labels.length - 1; idx2 >= 0; idx2--) {
                strSheetXml += `<c r="${getExcelColName(data[0].labels.length - idx2)}${idx + 2}" t="s">`;
                strSheetXml += `<v>${data.length + idx + 1}</v>`;
                strSheetXml += "</c>";
              }
              for (let idy = 0; idy < data.length; idy++) {
                strSheetXml += `<c r="${getExcelColName(data[0].labels.length + idy + 1)}${idx + 2}"><v>${data[idy].values[idx] || ""}</v></c>`;
              }
              strSheetXml += "</row>";
            });
          } else {
            strSheetXml += `<row r="1" spans="1:${data.length + data[0].labels.length}">`;
            for (let idx = 0; idx < data[0].labels.length; idx++) {
              strSheetXml += `<c r="${getExcelColName(idx + 1)}1" t="s"><v>0</v></c>`;
            }
            for (let idx = data[0].labels.length - 1; idx < data.length + data[0].labels.length - 1; idx++) {
              strSheetXml += `<c r="${getExcelColName(idx + data[0].labels.length)}1" t="s"><v>${idx}</v></c>`;
            }
            strSheetXml += "</row>";
            const TOT_SER = data.length;
            const TOT_CAT = data[0].labels[0].length;
            const TOT_LVL = data[0].labels.length;
            for (let idx = 0; idx < TOT_CAT; idx++) {
              strSheetXml += `<row r="${idx + 2}" spans="1:${TOT_SER + TOT_LVL}">`;
              let totLabels = TOT_SER;
              const revLabelGroups = data[0].labels.slice().reverse();
              revLabelGroups.forEach((labelsGroup, idy) => {
                const colLabel = labelsGroup[idx];
                if (colLabel) {
                  const totGrpLbls = idy === 0 ? 1 : revLabelGroups[idy - 1].filter((label) => label && label !== "").length;
                  totLabels += totGrpLbls;
                  strSheetXml += `<c r="${getExcelColName(idx + 1 + idy)}${idx + 2}" t="s"><v>${totLabels}</v></c>`;
                }
              });
              for (let idy = 0; idy < TOT_SER; idy++) {
                strSheetXml += `<c r="${getExcelColName(TOT_LVL + idy + 1)}${idx + 2}"><v>${data[idy].values[idx] || 0}</v></c>`;
              }
              strSheetXml += "</row>";
            }
          }
        }
        strSheetXml += "</sheetData>";
        strSheetXml += '<pageMargins left="0.7" right="0.7" top="0.75" bottom="0.75" header="0.3" footer="0.3"/>';
        strSheetXml += "</worksheet>\n";
        zipExcel.file("xl/worksheets/sheet1.xml", strSheetXml);
      }
      zipExcel.generateAsync({ type: "base64" }).then((content) => {
        zip.file(`ppt/embeddings/Microsoft_Excel_Worksheet${chartObject.globalId}.xlsx`, content, { base64: true });
        zip.file("ppt/charts/_rels/" + chartObject.fileName + ".rels", `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/package" Target="../embeddings/Microsoft_Excel_Worksheet${chartObject.globalId}.xlsx"/></Relationships>`);
        zip.file(`ppt/charts/${chartObject.fileName}`, makeXmlCharts(chartObject));
        resolve("");
      }).catch((strErr) => {
        reject(strErr);
      });
    });
  });
}
function makeXmlCharts(rel) {
  var _a, _b, _c, _d;
  let strXml = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>';
  let usesSecondaryValAxis = false;
  {
    strXml += '<c:chartSpace xmlns:c="http://schemas.openxmlformats.org/drawingml/2006/chart" xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">';
    strXml += '<c:date1904 val="0"/>';
    strXml += `<c:roundedCorners val="${rel.opts.chartArea.roundedCorners ? "1" : "0"}"/>`;
    strXml += "<c:chart>";
    if (rel.opts.showTitle) {
      strXml += genXmlTitle({
        title: rel.opts.title || "Chart Title",
        color: rel.opts.titleColor,
        fontFace: rel.opts.titleFontFace,
        fontSize: rel.opts.titleFontSize || DEF_FONT_TITLE_SIZE,
        titleAlign: rel.opts.titleAlign,
        titleBold: rel.opts.titleBold,
        titlePos: rel.opts.titlePos,
        titleRotate: rel.opts.titleRotate
      }, rel.opts.x, rel.opts.y);
      strXml += '<c:autoTitleDeleted val="0"/>';
    } else {
      strXml += '<c:autoTitleDeleted val="1"/>';
    }
    if (rel.opts._type === CHART_TYPE.BAR3D) {
      strXml += `<c:view3D><c:rotX val="${rel.opts.v3DRotX}"/><c:rotY val="${rel.opts.v3DRotY}"/><c:rAngAx val="${!rel.opts.v3DRAngAx ? 0 : 1}"/><c:perspective val="${rel.opts.v3DPerspective}"/></c:view3D>`;
    }
    strXml += "<c:plotArea>";
    if (rel.opts.layout) {
      strXml += "<c:layout>";
      strXml += " <c:manualLayout>";
      strXml += '  <c:layoutTarget val="inner" />';
      strXml += '  <c:xMode val="edge" />';
      strXml += '  <c:yMode val="edge" />';
      strXml += '  <c:x val="' + (rel.opts.layout.x || 0) + '" />';
      strXml += '  <c:y val="' + (rel.opts.layout.y || 0) + '" />';
      strXml += '  <c:w val="' + (rel.opts.layout.w || 1) + '" />';
      strXml += '  <c:h val="' + (rel.opts.layout.h || 1) + '" />';
      strXml += " </c:manualLayout>";
      strXml += "</c:layout>";
    } else {
      strXml += "<c:layout/>";
    }
  }
  if (Array.isArray(rel.opts._type)) {
    rel.opts._type.forEach((type) => {
      const options = Object.assign(Object.assign({}, rel.opts), type.options);
      const valAxisId = options.secondaryValAxis ? AXIS_ID_VALUE_SECONDARY : AXIS_ID_VALUE_PRIMARY;
      const catAxisId = options.secondaryCatAxis ? AXIS_ID_CATEGORY_SECONDARY : AXIS_ID_CATEGORY_PRIMARY;
      usesSecondaryValAxis = usesSecondaryValAxis || options.secondaryValAxis;
      strXml += makeChartType(type.type, type.data, options, valAxisId, catAxisId);
    });
  } else {
    strXml += makeChartType(rel.opts._type, rel.data, rel.opts, AXIS_ID_VALUE_PRIMARY, AXIS_ID_CATEGORY_PRIMARY);
  }
  if (rel.opts._type !== CHART_TYPE.PIE && rel.opts._type !== CHART_TYPE.DOUGHNUT) {
    if (rel.opts.valAxes && rel.opts.valAxes.length > 1 && !usesSecondaryValAxis) {
      throw new Error("Secondary axis must be used by one of the multiple charts");
    }
    if (rel.opts.catAxes) {
      if (!rel.opts.valAxes || rel.opts.valAxes.length !== rel.opts.catAxes.length) {
        throw new Error("There must be the same number of value and category axes.");
      }
      strXml += makeCatAxis(Object.assign(Object.assign({}, rel.opts), rel.opts.catAxes[0]), AXIS_ID_CATEGORY_PRIMARY, AXIS_ID_VALUE_PRIMARY);
    } else {
      strXml += makeCatAxis(rel.opts, AXIS_ID_CATEGORY_PRIMARY, AXIS_ID_VALUE_PRIMARY);
    }
    if (rel.opts.valAxes) {
      strXml += makeValAxis(Object.assign(Object.assign({}, rel.opts), rel.opts.valAxes[0]), AXIS_ID_VALUE_PRIMARY);
      if (rel.opts.valAxes[1]) {
        strXml += makeValAxis(Object.assign(Object.assign({}, rel.opts), rel.opts.valAxes[1]), AXIS_ID_VALUE_SECONDARY);
      }
    } else {
      strXml += makeValAxis(rel.opts, AXIS_ID_VALUE_PRIMARY);
      if (rel.opts._type === CHART_TYPE.BAR3D) {
        strXml += makeSerAxis(rel.opts, AXIS_ID_SERIES_PRIMARY, AXIS_ID_VALUE_PRIMARY);
      }
    }
    if (((_a = rel.opts) === null || _a === void 0 ? void 0 : _a.catAxes) && ((_b = rel.opts) === null || _b === void 0 ? void 0 : _b.catAxes[1])) {
      strXml += makeCatAxis(Object.assign(Object.assign({}, rel.opts), rel.opts.catAxes[1]), AXIS_ID_CATEGORY_SECONDARY, AXIS_ID_VALUE_SECONDARY);
    }
  }
  {
    if (rel.opts.showDataTable) {
      strXml += "<c:dTable>";
      strXml += `  <c:showHorzBorder val="${!rel.opts.showDataTableHorzBorder ? 0 : 1}"/>`;
      strXml += `  <c:showVertBorder val="${!rel.opts.showDataTableVertBorder ? 0 : 1}"/>`;
      strXml += `  <c:showOutline    val="${!rel.opts.showDataTableOutline ? 0 : 1}"/>`;
      strXml += `  <c:showKeys       val="${!rel.opts.showDataTableKeys ? 0 : 1}"/>`;
      strXml += "  <c:spPr>";
      strXml += "    <a:noFill/>";
      strXml += '    <a:ln w="9525" cap="flat" cmpd="sng" algn="ctr"><a:solidFill><a:schemeClr val="tx1"><a:lumMod val="15000"/><a:lumOff val="85000"/></a:schemeClr></a:solidFill><a:round/></a:ln>';
      strXml += "    <a:effectLst/>";
      strXml += "  </c:spPr>";
      strXml += "  <c:txPr>";
      strXml += '   <a:bodyPr rot="0" spcFirstLastPara="1" vertOverflow="ellipsis" vert="horz" wrap="square" anchor="ctr" anchorCtr="1"/>';
      strXml += "   <a:lstStyle/>";
      strXml += "   <a:p>";
      strXml += '     <a:pPr rtl="0">';
      strXml += `       <a:defRPr sz="${Math.round((rel.opts.dataTableFontSize || DEF_FONT_SIZE) * 100)}" b="0" i="0" u="none" strike="noStrike" kern="1200" baseline="0">`;
      strXml += '         <a:solidFill><a:schemeClr val="tx1"><a:lumMod val="65000"/><a:lumOff val="35000"/></a:schemeClr></a:solidFill>';
      strXml += '         <a:latin typeface="+mn-lt"/>';
      strXml += '         <a:ea typeface="+mn-ea"/>';
      strXml += '         <a:cs typeface="+mn-cs"/>';
      strXml += "       </a:defRPr>";
      strXml += "     </a:pPr>";
      strXml += '    <a:endParaRPr lang="en-US"/>';
      strXml += "   </a:p>";
      strXml += " </c:txPr>";
      strXml += "</c:dTable>";
    }
    strXml += "  <c:spPr>";
    strXml += ((_c = rel.opts.plotArea.fill) === null || _c === void 0 ? void 0 : _c.color) ? genXmlColorSelection(rel.opts.plotArea.fill) : "<a:noFill/>";
    strXml += rel.opts.plotArea.border ? `<a:ln w="${valToPts(rel.opts.plotArea.border.pt)}" cap="flat">${genXmlColorSelection(rel.opts.plotArea.border.color)}</a:ln>` : "<a:ln><a:noFill/></a:ln>";
    strXml += "    <a:effectLst/>";
    strXml += "  </c:spPr>";
    strXml += "</c:plotArea>";
    if (rel.opts.showLegend) {
      strXml += "<c:legend>";
      strXml += '<c:legendPos val="' + rel.opts.legendPos + '"/>';
      strXml += '<c:overlay val="0"/>';
      if (rel.opts.legendFontFace || rel.opts.legendFontSize || rel.opts.legendColor) {
        strXml += "<c:txPr>";
        strXml += "  <a:bodyPr/>";
        strXml += "  <a:lstStyle/>";
        strXml += "  <a:p>";
        strXml += "    <a:pPr>";
        strXml += rel.opts.legendFontSize ? `<a:defRPr sz="${Math.round(Number(rel.opts.legendFontSize) * 100)}">` : "<a:defRPr>";
        if (rel.opts.legendColor)
          strXml += genXmlColorSelection(rel.opts.legendColor);
        if (rel.opts.legendFontFace)
          strXml += '<a:latin typeface="' + rel.opts.legendFontFace + '"/>';
        if (rel.opts.legendFontFace)
          strXml += '<a:cs    typeface="' + rel.opts.legendFontFace + '"/>';
        strXml += "      </a:defRPr>";
        strXml += "    </a:pPr>";
        strXml += '    <a:endParaRPr lang="en-US"/>';
        strXml += "  </a:p>";
        strXml += "</c:txPr>";
      }
      strXml += "</c:legend>";
    }
  }
  strXml += '  <c:plotVisOnly val="1"/>';
  strXml += '  <c:dispBlanksAs val="' + rel.opts.displayBlanksAs + '"/>';
  if (rel.opts._type === CHART_TYPE.SCATTER)
    strXml += '<c:showDLblsOverMax val="1"/>';
  strXml += "</c:chart>";
  strXml += "<c:spPr>";
  strXml += ((_d = rel.opts.chartArea.fill) === null || _d === void 0 ? void 0 : _d.color) ? genXmlColorSelection(rel.opts.chartArea.fill) : "<a:noFill/>";
  strXml += rel.opts.chartArea.border ? `<a:ln w="${valToPts(rel.opts.chartArea.border.pt)}" cap="flat">${genXmlColorSelection(rel.opts.chartArea.border.color)}</a:ln>` : "<a:ln><a:noFill/></a:ln>";
  strXml += "  <a:effectLst/>";
  strXml += "</c:spPr>";
  strXml += '<c:externalData r:id="rId1"><c:autoUpdate val="0"/></c:externalData>';
  strXml += "</c:chartSpace>";
  return strXml;
}
function makeChartType(chartType, data, opts, valAxisId, catAxisId, isMultiTypeChart) {
  let colorIndex = -1;
  let idxColLtr = 1;
  let optsChartData = null;
  let strXml = "";
  switch (chartType) {
    case CHART_TYPE.AREA:
    case CHART_TYPE.BAR:
    case CHART_TYPE.BAR3D:
    case CHART_TYPE.LINE:
    case CHART_TYPE.RADAR:
      strXml += `<c:${chartType}Chart>`;
      if (chartType === CHART_TYPE.AREA && opts.barGrouping === "stacked") {
        strXml += '<c:grouping val="' + opts.barGrouping + '"/>';
      }
      if (chartType === CHART_TYPE.BAR || chartType === CHART_TYPE.BAR3D) {
        strXml += '<c:barDir val="' + opts.barDir + '"/>';
        strXml += '<c:grouping val="' + (opts.barGrouping || "clustered") + '"/>';
      }
      if (chartType === CHART_TYPE.RADAR) {
        strXml += '<c:radarStyle val="' + opts.radarStyle + '"/>';
      }
      strXml += '<c:varyColors val="0"/>';
      data.forEach((obj) => {
        var _a;
        colorIndex++;
        strXml += "<c:ser>";
        strXml += `  <c:idx val="${obj._dataIndex}"/><c:order val="${obj._dataIndex}"/>`;
        strXml += "  <c:tx>";
        strXml += "    <c:strRef>";
        strXml += "      <c:f>Sheet1!$" + getExcelColName(obj._dataIndex + obj.labels.length + 1) + "$1</c:f>";
        strXml += '      <c:strCache><c:ptCount val="1"/><c:pt idx="0"><c:v>' + encodeXmlEntities(obj.name) + "</c:v></c:pt></c:strCache>";
        strXml += "    </c:strRef>";
        strXml += "  </c:tx>";
        const seriesColor = opts.chartColors ? opts.chartColors[colorIndex % opts.chartColors.length] : null;
        strXml += "  <c:spPr>";
        if (seriesColor === "transparent") {
          strXml += "<a:noFill/>";
        } else if (opts.chartColorsOpacity) {
          strXml += "<a:solidFill>" + createColorElement(seriesColor, `<a:alpha val="${Math.round(opts.chartColorsOpacity * 1e3)}"/>`) + "</a:solidFill>";
        } else {
          strXml += "<a:solidFill>" + createColorElement(seriesColor) + "</a:solidFill>";
        }
        if (chartType === CHART_TYPE.LINE || chartType === CHART_TYPE.RADAR) {
          if (opts.lineSize === 0) {
            strXml += "<a:ln><a:noFill/></a:ln>";
          } else {
            strXml += `<a:ln w="${valToPts(opts.lineSize)}" cap="${createLineCap(opts.lineCap)}"><a:solidFill>${createColorElement(seriesColor)}</a:solidFill>`;
            strXml += '<a:prstDash val="' + (opts.lineDash || "solid") + '"/><a:round/></a:ln>';
          }
        } else if (opts.dataBorder) {
          strXml += `<a:ln w="${valToPts(opts.dataBorder.pt)}" cap="${createLineCap(opts.lineCap)}"><a:solidFill>${createColorElement(opts.dataBorder.color)}</a:solidFill><a:prstDash val="solid"/><a:round/></a:ln>`;
        }
        strXml += createShadowElement(opts.shadow, DEF_SHAPE_SHADOW);
        strXml += "  </c:spPr>";
        strXml += '  <c:invertIfNegative val="0"/>';
        if (chartType !== CHART_TYPE.RADAR) {
          strXml += "<c:dLbls>";
          strXml += `<c:numFmt formatCode="${encodeXmlEntities(opts.dataLabelFormatCode) || "General"}" sourceLinked="0"/>`;
          if (opts.dataLabelBkgrdColors)
            strXml += `<c:spPr><a:solidFill>${createColorElement(seriesColor)}</a:solidFill></c:spPr>`;
          strXml += "<c:txPr><a:bodyPr/><a:lstStyle/><a:p><a:pPr>";
          strXml += `<a:defRPr b="${opts.dataLabelFontBold ? 1 : 0}" i="${opts.dataLabelFontItalic ? 1 : 0}" strike="noStrike" sz="${Math.round((opts.dataLabelFontSize || DEF_FONT_SIZE) * 100)}" u="none">`;
          strXml += `<a:solidFill>${createColorElement(opts.dataLabelColor || DEF_FONT_COLOR)}</a:solidFill>`;
          strXml += `<a:latin typeface="${opts.dataLabelFontFace || "Arial"}"/>`;
          strXml += "</a:defRPr></a:pPr></a:p></c:txPr>";
          if (opts.dataLabelPosition)
            strXml += `<c:dLblPos val="${opts.dataLabelPosition}"/>`;
          strXml += '<c:showLegendKey val="0"/>';
          strXml += `<c:showVal val="${opts.showValue ? "1" : "0"}"/>`;
          strXml += `<c:showCatName val="0"/><c:showSerName val="${opts.showSerName ? "1" : "0"}"/><c:showPercent val="0"/><c:showBubbleSize val="0"/>`;
          strXml += `<c:showLeaderLines val="${opts.showLeaderLines ? "1" : "0"}"/>`;
          strXml += "</c:dLbls>";
        }
        if (chartType === CHART_TYPE.LINE || chartType === CHART_TYPE.RADAR) {
          strXml += "<c:marker>";
          strXml += '  <c:symbol val="' + opts.lineDataSymbol + '"/>';
          if (opts.lineDataSymbolSize)
            strXml += `<c:size val="${opts.lineDataSymbolSize}"/>`;
          strXml += "  <c:spPr>";
          strXml += `    <a:solidFill>${createColorElement(opts.chartColors[obj._dataIndex + 1 > opts.chartColors.length ? Math.floor(Math.random() * opts.chartColors.length) : obj._dataIndex])}</a:solidFill>`;
          strXml += `    <a:ln w="${opts.lineDataSymbolLineSize}" cap="flat"><a:solidFill>${createColorElement(opts.lineDataSymbolLineColor || seriesColor)}</a:solidFill><a:prstDash val="solid"/><a:round/></a:ln>`;
          strXml += "    <a:effectLst/>";
          strXml += "  </c:spPr>";
          strXml += "</c:marker>";
        }
        if ((chartType === CHART_TYPE.BAR || chartType === CHART_TYPE.BAR3D) && data.length === 1 && (opts.chartColors && opts.chartColors !== BARCHART_COLORS && opts.chartColors.length > 1 || ((_a = opts.invertedColors) === null || _a === void 0 ? void 0 : _a.length))) {
          obj.values.forEach((value, index) => {
            const arrColors = value < 0 ? opts.invertedColors || opts.chartColors || BARCHART_COLORS : opts.chartColors || [];
            strXml += "  <c:dPt>";
            strXml += `    <c:idx val="${index}"/>`;
            strXml += '      <c:invertIfNegative val="0"/>';
            strXml += '    <c:bubble3D val="0"/>';
            strXml += "    <c:spPr>";
            if (opts.lineSize === 0) {
              strXml += "<a:ln><a:noFill/></a:ln>";
            } else if (chartType === CHART_TYPE.BAR) {
              strXml += "<a:solidFill>";
              strXml += '  <a:srgbClr val="' + arrColors[index % arrColors.length] + '"/>';
              strXml += "</a:solidFill>";
            } else {
              strXml += "<a:ln>";
              strXml += "  <a:solidFill>";
              strXml += '   <a:srgbClr val="' + arrColors[index % arrColors.length] + '"/>';
              strXml += "  </a:solidFill>";
              strXml += "</a:ln>";
            }
            strXml += createShadowElement(opts.shadow, DEF_SHAPE_SHADOW);
            strXml += "    </c:spPr>";
            strXml += "  </c:dPt>";
          });
        }
        {
          strXml += "<c:cat>";
          if (opts.catLabelFormatCode) {
            strXml += "  <c:numRef>";
            strXml += `    <c:f>Sheet1!$A$2:$A$${obj.labels[0].length + 1}</c:f>`;
            strXml += "    <c:numCache>";
            strXml += "      <c:formatCode>" + (opts.catLabelFormatCode || "General") + "</c:formatCode>";
            strXml += `      <c:ptCount val="${obj.labels[0].length}"/>`;
            obj.labels[0].forEach((label, idx) => strXml += `<c:pt idx="${idx}"><c:v>${encodeXmlEntities(label)}</c:v></c:pt>`);
            strXml += "    </c:numCache>";
            strXml += "  </c:numRef>";
          } else {
            strXml += "  <c:multiLvlStrRef>";
            strXml += `    <c:f>Sheet1!$A$2:$${getExcelColName(obj.labels.length)}$${obj.labels[0].length + 1}</c:f>`;
            strXml += "    <c:multiLvlStrCache>";
            strXml += `      <c:ptCount val="${obj.labels[0].length}"/>`;
            obj.labels.forEach((labelsGroup) => {
              strXml += "<c:lvl>";
              labelsGroup.forEach((label, idx) => strXml += `<c:pt idx="${idx}"><c:v>${encodeXmlEntities(label)}</c:v></c:pt>`);
              strXml += "</c:lvl>";
            });
            strXml += "    </c:multiLvlStrCache>";
            strXml += "  </c:multiLvlStrRef>";
          }
          strXml += "</c:cat>";
        }
        {
          strXml += "<c:val>";
          strXml += "  <c:numRef>";
          strXml += `<c:f>Sheet1!$${getExcelColName(obj._dataIndex + obj.labels.length + 1)}$2:$${getExcelColName(obj._dataIndex + obj.labels.length + 1)}$${obj.labels[0].length + 1}</c:f>`;
          strXml += "    <c:numCache>";
          strXml += "      <c:formatCode>" + (opts.valLabelFormatCode || opts.dataTableFormatCode || "General") + "</c:formatCode>";
          strXml += `      <c:ptCount val="${obj.labels[0].length}"/>`;
          obj.values.forEach((value, idx) => strXml += `<c:pt idx="${idx}"><c:v>${value || value === 0 ? value : ""}</c:v></c:pt>`);
          strXml += "    </c:numCache>";
          strXml += "  </c:numRef>";
          strXml += "</c:val>";
        }
        if (chartType === CHART_TYPE.LINE)
          strXml += '<c:smooth val="' + (opts.lineSmooth ? "1" : "0") + '"/>';
        strXml += "</c:ser>";
      });
      {
        strXml += "  <c:dLbls>";
        strXml += `    <c:numFmt formatCode="${encodeXmlEntities(opts.dataLabelFormatCode) || "General"}" sourceLinked="0"/>`;
        strXml += "    <c:txPr>";
        strXml += "      <a:bodyPr/>";
        strXml += "      <a:lstStyle/>";
        strXml += "      <a:p><a:pPr>";
        strXml += `        <a:defRPr b="${opts.dataLabelFontBold ? 1 : 0}" i="${opts.dataLabelFontItalic ? 1 : 0}" strike="noStrike" sz="${Math.round((opts.dataLabelFontSize || DEF_FONT_SIZE) * 100)}" u="none">`;
        strXml += "          <a:solidFill>" + createColorElement(opts.dataLabelColor || DEF_FONT_COLOR) + "</a:solidFill>";
        strXml += '          <a:latin typeface="' + (opts.dataLabelFontFace || "Arial") + '"/>';
        strXml += "        </a:defRPr>";
        strXml += "      </a:pPr></a:p>";
        strXml += "    </c:txPr>";
        if (opts.dataLabelPosition)
          strXml += ' <c:dLblPos val="' + opts.dataLabelPosition + '"/>';
        strXml += '    <c:showLegendKey val="0"/>';
        strXml += '    <c:showVal val="' + (opts.showValue ? "1" : "0") + '"/>';
        strXml += '    <c:showCatName val="0"/>';
        strXml += '    <c:showSerName val="' + (opts.showSerName ? "1" : "0") + '"/>';
        strXml += '    <c:showPercent val="0"/>';
        strXml += '    <c:showBubbleSize val="0"/>';
        strXml += `    <c:showLeaderLines val="${opts.showLeaderLines ? "1" : "0"}"/>`;
        strXml += "  </c:dLbls>";
      }
      if (chartType === CHART_TYPE.BAR) {
        strXml += `  <c:gapWidth val="${opts.barGapWidthPct}"/>`;
        strXml += `  <c:overlap val="${(opts.barGrouping || "").includes("tacked") ? 100 : opts.barOverlapPct ? opts.barOverlapPct : 0}"/>`;
      } else if (chartType === CHART_TYPE.BAR3D) {
        strXml += `  <c:gapWidth val="${opts.barGapWidthPct}"/>`;
        strXml += `  <c:gapDepth val="${opts.barGapDepthPct}"/>`;
        strXml += '  <c:shape val="' + opts.bar3DShape + '"/>';
      } else if (chartType === CHART_TYPE.LINE) {
        strXml += '  <c:marker val="1"/>';
      }
      strXml += `<c:axId val="${catAxisId}"/><c:axId val="${valAxisId}"/><c:axId val="${AXIS_ID_SERIES_PRIMARY}"/>`;
      strXml += `</c:${chartType}Chart>`;
      break;
    case CHART_TYPE.SCATTER:
      strXml += "<c:" + chartType + "Chart>";
      strXml += '<c:scatterStyle val="lineMarker"/>';
      strXml += '<c:varyColors val="0"/>';
      colorIndex = -1;
      data.filter((_obj, idx) => idx > 0).forEach((obj, idx) => {
        colorIndex++;
        strXml += "<c:ser>";
        strXml += `  <c:idx val="${idx}"/>`;
        strXml += `  <c:order val="${idx}"/>`;
        strXml += "  <c:tx>";
        strXml += "    <c:strRef>";
        strXml += `      <c:f>Sheet1!$${getExcelColName(idx + 2)}$1</c:f>`;
        strXml += '      <c:strCache><c:ptCount val="1"/><c:pt idx="0"><c:v>' + encodeXmlEntities(obj.name) + "</c:v></c:pt></c:strCache>";
        strXml += "    </c:strRef>";
        strXml += "  </c:tx>";
        strXml += "  <c:spPr>";
        {
          const tmpSerColor = opts.chartColors[colorIndex % opts.chartColors.length];
          if (tmpSerColor === "transparent") {
            strXml += "<a:noFill/>";
          } else if (opts.chartColorsOpacity) {
            strXml += "<a:solidFill>" + createColorElement(tmpSerColor, '<a:alpha val="' + Math.round(opts.chartColorsOpacity * 1e3).toString() + '"/>') + "</a:solidFill>";
          } else {
            strXml += "<a:solidFill>" + createColorElement(tmpSerColor) + "</a:solidFill>";
          }
          if (opts.lineSize === 0) {
            strXml += "<a:ln><a:noFill/></a:ln>";
          } else {
            strXml += `<a:ln w="${valToPts(opts.lineSize)}" cap="${createLineCap(opts.lineCap)}"><a:solidFill>${createColorElement(tmpSerColor)}</a:solidFill>`;
            strXml += `<a:prstDash val="${opts.lineDash || "solid"}"/><a:round/></a:ln>`;
          }
          strXml += createShadowElement(opts.shadow, DEF_SHAPE_SHADOW);
        }
        strXml += "  </c:spPr>";
        {
          strXml += "<c:marker>";
          strXml += '  <c:symbol val="' + opts.lineDataSymbol + '"/>';
          if (opts.lineDataSymbolSize) {
            strXml += `<c:size val="${opts.lineDataSymbolSize}"/>`;
          }
          strXml += "<c:spPr>";
          strXml += `<a:solidFill>${createColorElement(opts.chartColors[idx + 1 > opts.chartColors.length ? Math.floor(Math.random() * opts.chartColors.length) : idx])}</a:solidFill>`;
          strXml += `<a:ln w="${opts.lineDataSymbolLineSize}" cap="flat"><a:solidFill>${createColorElement(opts.lineDataSymbolLineColor || opts.chartColors[colorIndex % opts.chartColors.length])}</a:solidFill><a:prstDash val="solid"/><a:round/></a:ln>`;
          strXml += "<a:effectLst/>";
          strXml += "</c:spPr>";
          strXml += "</c:marker>";
        }
        if (opts.showLabel) {
          const chartUuid = getUuid("-xxxx-xxxx-xxxx-xxxxxxxxxxxx");
          if (obj.labels[0] && (opts.dataLabelFormatScatter === "custom" || opts.dataLabelFormatScatter === "customXY")) {
            strXml += "<c:dLbls>";
            obj.labels[0].forEach((label, idx2) => {
              if (opts.dataLabelFormatScatter === "custom" || opts.dataLabelFormatScatter === "customXY") {
                strXml += "  <c:dLbl>";
                strXml += `    <c:idx val="${idx2}"/>`;
                strXml += "    <c:tx>";
                strXml += "      <c:rich>";
                strXml += "            <a:bodyPr>";
                strXml += "                <a:spAutoFit/>";
                strXml += "            </a:bodyPr>";
                strXml += "            <a:lstStyle/>";
                strXml += "            <a:p>";
                strXml += "                <a:pPr>";
                strXml += "                    <a:defRPr/>";
                strXml += "                </a:pPr>";
                strXml += "              <a:r>";
                strXml += '                    <a:rPr lang="' + (opts.lang || "en-US") + '" dirty="0"/>';
                strXml += "                    <a:t>" + encodeXmlEntities(label) + "</a:t>";
                strXml += "              </a:r>";
                if (opts.dataLabelFormatScatter === "customXY" && !/^ *$/.test(label)) {
                  strXml += "              <a:r>";
                  strXml += '                  <a:rPr lang="' + (opts.lang || "en-US") + '" baseline="0" dirty="0"/>';
                  strXml += "                  <a:t> (</a:t>";
                  strXml += "              </a:r>";
                  strXml += '              <a:fld id="{' + getUuid("xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx") + '}" type="XVALUE">';
                  strXml += '                  <a:rPr lang="' + (opts.lang || "en-US") + '" baseline="0"/>';
                  strXml += "                  <a:pPr>";
                  strXml += "                      <a:defRPr/>";
                  strXml += "                  </a:pPr>";
                  strXml += "                  <a:t>[" + encodeXmlEntities(obj.name) + "</a:t>";
                  strXml += "              </a:fld>";
                  strXml += "              <a:r>";
                  strXml += '                  <a:rPr lang="' + (opts.lang || "en-US") + '" baseline="0" dirty="0"/>';
                  strXml += "                  <a:t>, </a:t>";
                  strXml += "              </a:r>";
                  strXml += '              <a:fld id="{' + getUuid("xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx") + '}" type="YVALUE">';
                  strXml += '                  <a:rPr lang="' + (opts.lang || "en-US") + '" baseline="0"/>';
                  strXml += "                  <a:pPr>";
                  strXml += "                      <a:defRPr/>";
                  strXml += "                  </a:pPr>";
                  strXml += "                  <a:t>[" + encodeXmlEntities(obj.name) + "]</a:t>";
                  strXml += "              </a:fld>";
                  strXml += "              <a:r>";
                  strXml += '                  <a:rPr lang="' + (opts.lang || "en-US") + '" baseline="0" dirty="0"/>';
                  strXml += "                  <a:t>)</a:t>";
                  strXml += "              </a:r>";
                  strXml += '              <a:endParaRPr lang="' + (opts.lang || "en-US") + '" dirty="0"/>';
                }
                strXml += "            </a:p>";
                strXml += "      </c:rich>";
                strXml += "    </c:tx>";
                strXml += "    <c:spPr>";
                strXml += "        <a:noFill/>";
                strXml += "        <a:ln>";
                strXml += "            <a:noFill/>";
                strXml += "        </a:ln>";
                strXml += "        <a:effectLst/>";
                strXml += "    </c:spPr>";
                if (opts.dataLabelPosition)
                  strXml += ' <c:dLblPos val="' + opts.dataLabelPosition + '"/>';
                strXml += '    <c:showLegendKey val="0"/>';
                strXml += '    <c:showVal val="0"/>';
                strXml += '    <c:showCatName val="0"/>';
                strXml += '    <c:showSerName val="0"/>';
                strXml += '    <c:showPercent val="0"/>';
                strXml += '    <c:showBubbleSize val="0"/>';
                strXml += '       <c:showLeaderLines val="1"/>';
                strXml += "    <c:extLst>";
                strXml += '      <c:ext uri="{CE6537A1-D6FC-4f65-9D91-7224C49458BB}" xmlns:c15="http://schemas.microsoft.com/office/drawing/2012/chart"/>';
                strXml += '      <c:ext uri="{C3380CC4-5D6E-409C-BE32-E72D297353CC}" xmlns:c16="http://schemas.microsoft.com/office/drawing/2014/chart">';
                strXml += `            <c16:uniqueId val="{${"00000000".substring(0, 8 - (idx2 + 1).toString().length).toString()}${idx2 + 1}${chartUuid}}"/>`;
                strXml += "      </c:ext>";
                strXml += "        </c:extLst>";
                strXml += "</c:dLbl>";
              }
            });
            strXml += "</c:dLbls>";
          }
          if (opts.dataLabelFormatScatter === "XY") {
            strXml += "<c:dLbls>";
            strXml += "    <c:spPr>";
            strXml += "        <a:noFill/>";
            strXml += "        <a:ln>";
            strXml += "            <a:noFill/>";
            strXml += "        </a:ln>";
            strXml += "          <a:effectLst/>";
            strXml += "    </c:spPr>";
            strXml += "    <c:txPr>";
            strXml += "        <a:bodyPr>";
            strXml += "            <a:spAutoFit/>";
            strXml += "        </a:bodyPr>";
            strXml += "        <a:lstStyle/>";
            strXml += "        <a:p>";
            strXml += "            <a:pPr>";
            strXml += "                <a:defRPr/>";
            strXml += "            </a:pPr>";
            strXml += '            <a:endParaRPr lang="en-US"/>';
            strXml += "        </a:p>";
            strXml += "    </c:txPr>";
            if (opts.dataLabelPosition)
              strXml += ' <c:dLblPos val="' + opts.dataLabelPosition + '"/>';
            strXml += '    <c:showLegendKey val="0"/>';
            strXml += ` <c:showVal val="${opts.showLabel ? "1" : "0"}"/>`;
            strXml += ` <c:showCatName val="${opts.showLabel ? "1" : "0"}"/>`;
            strXml += ` <c:showSerName val="${opts.showSerName ? "1" : "0"}"/>`;
            strXml += '    <c:showPercent val="0"/>';
            strXml += '    <c:showBubbleSize val="0"/>';
            strXml += "    <c:extLst>";
            strXml += '        <c:ext uri="{CE6537A1-D6FC-4f65-9D91-7224C49458BB}" xmlns:c15="http://schemas.microsoft.com/office/drawing/2012/chart">';
            strXml += '            <c15:showLeaderLines val="1"/>';
            strXml += "        </c:ext>";
            strXml += "    </c:extLst>";
            strXml += "</c:dLbls>";
          }
        }
        if (data.length === 1 && opts.chartColors !== BARCHART_COLORS) {
          obj.values.forEach((value, index) => {
            const arrColors = value < 0 ? opts.invertedColors || opts.chartColors || BARCHART_COLORS : opts.chartColors || [];
            strXml += "  <c:dPt>";
            strXml += `    <c:idx val="${index}"/>`;
            strXml += '      <c:invertIfNegative val="0"/>';
            strXml += '    <c:bubble3D val="0"/>';
            strXml += "    <c:spPr>";
            if (opts.lineSize === 0) {
              strXml += "<a:ln><a:noFill/></a:ln>";
            } else {
              strXml += "<a:solidFill>";
              strXml += ' <a:srgbClr val="' + arrColors[index % arrColors.length] + '"/>';
              strXml += "</a:solidFill>";
            }
            strXml += createShadowElement(opts.shadow, DEF_SHAPE_SHADOW);
            strXml += "    </c:spPr>";
            strXml += "  </c:dPt>";
          });
        }
        {
          strXml += "<c:xVal>";
          strXml += "  <c:numRef>";
          strXml += `    <c:f>Sheet1!$A$2:$A$${data[0].values.length + 1}</c:f>`;
          strXml += "    <c:numCache>";
          strXml += "      <c:formatCode>General</c:formatCode>";
          strXml += `      <c:ptCount val="${data[0].values.length}"/>`;
          data[0].values.forEach((value, idx2) => {
            strXml += `<c:pt idx="${idx2}"><c:v>${value || value === 0 ? value : ""}</c:v></c:pt>`;
          });
          strXml += "    </c:numCache>";
          strXml += "  </c:numRef>";
          strXml += "</c:xVal>";
          strXml += "<c:yVal>";
          strXml += "  <c:numRef>";
          strXml += `    <c:f>Sheet1!$${getExcelColName(idx + 2)}$2:$${getExcelColName(idx + 2)}$${data[0].values.length + 1}</c:f>`;
          strXml += "    <c:numCache>";
          strXml += "      <c:formatCode>General</c:formatCode>";
          strXml += `      <c:ptCount val="${data[0].values.length}"/>`;
          data[0].values.forEach((_value, idx2) => {
            strXml += `<c:pt idx="${idx2}"><c:v>${obj.values[idx2] || obj.values[idx2] === 0 ? obj.values[idx2] : ""}</c:v></c:pt>`;
          });
          strXml += "    </c:numCache>";
          strXml += "  </c:numRef>";
          strXml += "</c:yVal>";
        }
        strXml += '<c:smooth val="' + (opts.lineSmooth ? "1" : "0") + '"/>';
        strXml += "</c:ser>";
      });
      {
        strXml += "  <c:dLbls>";
        strXml += `    <c:numFmt formatCode="${encodeXmlEntities(opts.dataLabelFormatCode) || "General"}" sourceLinked="0"/>`;
        strXml += "    <c:txPr>";
        strXml += "      <a:bodyPr/>";
        strXml += "      <a:lstStyle/>";
        strXml += "      <a:p><a:pPr>";
        strXml += `        <a:defRPr b="${opts.dataLabelFontBold ? "1" : "0"}" i="${opts.dataLabelFontItalic ? "1" : "0"}" strike="noStrike" sz="${Math.round((opts.dataLabelFontSize || DEF_FONT_SIZE) * 100)}" u="none">`;
        strXml += "          <a:solidFill>" + createColorElement(opts.dataLabelColor || DEF_FONT_COLOR) + "</a:solidFill>";
        strXml += '          <a:latin typeface="' + (opts.dataLabelFontFace || "Arial") + '"/>';
        strXml += "        </a:defRPr>";
        strXml += "      </a:pPr></a:p>";
        strXml += "    </c:txPr>";
        if (opts.dataLabelPosition)
          strXml += ' <c:dLblPos val="' + opts.dataLabelPosition + '"/>';
        strXml += '    <c:showLegendKey val="0"/>';
        strXml += '    <c:showVal val="' + (opts.showValue ? "1" : "0") + '"/>';
        strXml += '    <c:showCatName val="0"/>';
        strXml += '    <c:showSerName val="' + (opts.showSerName ? "1" : "0") + '"/>';
        strXml += '    <c:showPercent val="0"/>';
        strXml += '    <c:showBubbleSize val="0"/>';
        strXml += "  </c:dLbls>";
      }
      strXml += `<c:axId val="${catAxisId}"/><c:axId val="${valAxisId}"/>`;
      strXml += "</c:" + chartType + "Chart>";
      break;
    case CHART_TYPE.BUBBLE:
    case CHART_TYPE.BUBBLE3D:
      strXml += "<c:bubbleChart>";
      strXml += '<c:varyColors val="0"/>';
      colorIndex = -1;
      data.filter((_obj, idx) => idx > 0).forEach((obj, idx) => {
        colorIndex++;
        strXml += "<c:ser>";
        strXml += `  <c:idx val="${idx}"/>`;
        strXml += `  <c:order val="${idx}"/>`;
        strXml += "  <c:tx>";
        strXml += "    <c:strRef>";
        strXml += "      <c:f>Sheet1!$" + getExcelColName(idxColLtr + 1) + "$1</c:f>";
        strXml += '      <c:strCache><c:ptCount val="1"/><c:pt idx="0"><c:v>' + encodeXmlEntities(obj.name) + "</c:v></c:pt></c:strCache>";
        strXml += "    </c:strRef>";
        strXml += "  </c:tx>";
        {
          strXml += "<c:spPr>";
          const tmpSerColor = opts.chartColors[colorIndex % opts.chartColors.length];
          if (tmpSerColor === "transparent") {
            strXml += "<a:noFill/>";
          } else if (opts.chartColorsOpacity) {
            strXml += `<a:solidFill>${createColorElement(tmpSerColor, '<a:alpha val="' + Math.round(opts.chartColorsOpacity * 1e3).toString() + '"/>')}</a:solidFill>`;
          } else {
            strXml += "<a:solidFill>" + createColorElement(tmpSerColor) + "</a:solidFill>";
          }
          if (opts.lineSize === 0) {
            strXml += "<a:ln><a:noFill/></a:ln>";
          } else if (opts.dataBorder) {
            strXml += `<a:ln w="${valToPts(opts.dataBorder.pt)}" cap="flat"><a:solidFill>${createColorElement(opts.dataBorder.color)}</a:solidFill><a:prstDash val="solid"/><a:round/></a:ln>`;
          } else {
            strXml += `<a:ln w="${valToPts(opts.lineSize)}" cap="flat"><a:solidFill>${createColorElement(tmpSerColor)}</a:solidFill>`;
            strXml += `<a:prstDash val="${opts.lineDash || "solid"}"/><a:round/></a:ln>`;
          }
          strXml += createShadowElement(opts.shadow, DEF_SHAPE_SHADOW);
          strXml += "</c:spPr>";
        }
        {
          strXml += "<c:xVal>";
          strXml += "  <c:numRef>";
          strXml += `    <c:f>Sheet1!$A$2:$A$${data[0].values.length + 1}</c:f>`;
          strXml += "    <c:numCache>";
          strXml += "      <c:formatCode>General</c:formatCode>";
          strXml += `      <c:ptCount val="${data[0].values.length}"/>`;
          data[0].values.forEach((value, idx2) => {
            strXml += `<c:pt idx="${idx2}"><c:v>${value || value === 0 ? value : ""}</c:v></c:pt>`;
          });
          strXml += "    </c:numCache>";
          strXml += "  </c:numRef>";
          strXml += "</c:xVal>";
          strXml += "<c:yVal>";
          strXml += "  <c:numRef>";
          strXml += `<c:f>Sheet1!$${getExcelColName(idxColLtr + 1)}$2:$${getExcelColName(idxColLtr + 1)}$${data[0].values.length + 1}</c:f>`;
          idxColLtr++;
          strXml += "    <c:numCache>";
          strXml += "      <c:formatCode>General</c:formatCode>";
          strXml += `      <c:ptCount val="${data[0].values.length}"/>`;
          data[0].values.forEach((_value, idx2) => {
            strXml += `<c:pt idx="${idx2}"><c:v>${obj.values[idx2] || obj.values[idx2] === 0 ? obj.values[idx2] : ""}</c:v></c:pt>`;
          });
          strXml += "    </c:numCache>";
          strXml += "  </c:numRef>";
          strXml += "</c:yVal>";
        }
        strXml += "  <c:bubbleSize>";
        strXml += "    <c:numRef>";
        strXml += `<c:f>Sheet1!$${getExcelColName(idxColLtr + 1)}$2:$${getExcelColName(idxColLtr + 1)}$${obj.sizes.length + 1}</c:f>`;
        idxColLtr++;
        strXml += "      <c:numCache>";
        strXml += "        <c:formatCode>General</c:formatCode>";
        strXml += `           <c:ptCount val="${obj.sizes.length}"/>`;
        obj.sizes.forEach((value, idx2) => {
          strXml += `<c:pt idx="${idx2}"><c:v>${value || ""}</c:v></c:pt>`;
        });
        strXml += "      </c:numCache>";
        strXml += "    </c:numRef>";
        strXml += "  </c:bubbleSize>";
        strXml += '  <c:bubble3D val="' + (chartType === CHART_TYPE.BUBBLE3D ? "1" : "0") + '"/>';
        strXml += "</c:ser>";
      });
      {
        strXml += "<c:dLbls>";
        strXml += `<c:numFmt formatCode="${encodeXmlEntities(opts.dataLabelFormatCode) || "General"}" sourceLinked="0"/>`;
        strXml += "<c:txPr><a:bodyPr/><a:lstStyle/><a:p><a:pPr>";
        strXml += `<a:defRPr b="${opts.dataLabelFontBold ? 1 : 0}" i="${opts.dataLabelFontItalic ? 1 : 0}" strike="noStrike" sz="${Math.round(Math.round(opts.dataLabelFontSize || DEF_FONT_SIZE) * 100)}" u="none">`;
        strXml += `<a:solidFill>${createColorElement(opts.dataLabelColor || DEF_FONT_COLOR)}</a:solidFill>`;
        strXml += `<a:latin typeface="${opts.dataLabelFontFace || "Arial"}"/>`;
        strXml += "</a:defRPr></a:pPr></a:p></c:txPr>";
        if (opts.dataLabelPosition)
          strXml += `<c:dLblPos val="${opts.dataLabelPosition}"/>`;
        strXml += '<c:showLegendKey val="0"/>';
        strXml += `<c:showVal val="${opts.showValue ? "1" : "0"}"/>`;
        strXml += `<c:showCatName val="0"/><c:showSerName val="${opts.showSerName ? "1" : "0"}"/><c:showPercent val="0"/><c:showBubbleSize val="0"/>`;
        strXml += "<c:extLst>";
        strXml += '  <c:ext uri="{CE6537A1-D6FC-4f65-9D91-7224C49458BB}" xmlns:c15="http://schemas.microsoft.com/office/drawing/2012/chart">';
        strXml += '    <c15:showLeaderLines val="' + (opts.showLeaderLines ? "1" : "0") + '"/>';
        strXml += "  </c:ext>";
        strXml += "</c:extLst>";
        strXml += "</c:dLbls>";
      }
      strXml += `<c:axId val="${catAxisId}"/><c:axId val="${valAxisId}"/>`;
      strXml += "</c:bubbleChart>";
      break;
    case CHART_TYPE.DOUGHNUT:
    case CHART_TYPE.PIE:
      optsChartData = data[0];
      strXml += "<c:" + chartType + "Chart>";
      strXml += '  <c:varyColors val="1"/>';
      strXml += "<c:ser>";
      strXml += '  <c:idx val="0"/>';
      strXml += '  <c:order val="0"/>';
      strXml += "  <c:tx>";
      strXml += "    <c:strRef>";
      strXml += "      <c:f>Sheet1!$B$1</c:f>";
      strXml += "      <c:strCache>";
      strXml += '        <c:ptCount val="1"/>';
      strXml += '        <c:pt idx="0"><c:v>' + encodeXmlEntities(optsChartData.name) + "</c:v></c:pt>";
      strXml += "      </c:strCache>";
      strXml += "    </c:strRef>";
      strXml += "  </c:tx>";
      strXml += "  <c:spPr>";
      strXml += '    <a:solidFill><a:schemeClr val="accent1"/></a:solidFill>';
      strXml += '    <a:ln w="9525" cap="flat"><a:solidFill><a:srgbClr val="F9F9F9"/></a:solidFill><a:prstDash val="solid"/><a:round/></a:ln>';
      if (opts.dataNoEffects) {
        strXml += "<a:effectLst/>";
      } else {
        strXml += createShadowElement(opts.shadow, DEF_SHAPE_SHADOW);
      }
      strXml += "  </c:spPr>";
      optsChartData.labels[0].forEach((_label, idx) => {
        strXml += "<c:dPt>";
        strXml += ` <c:idx val="${idx}"/>`;
        strXml += ' <c:bubble3D val="0"/>';
        strXml += " <c:spPr>";
        strXml += `<a:solidFill>${createColorElement(opts.chartColors[idx + 1 > opts.chartColors.length ? Math.floor(Math.random() * opts.chartColors.length) : idx])}</a:solidFill>`;
        if (opts.dataBorder) {
          strXml += `<a:ln w="${valToPts(opts.dataBorder.pt)}" cap="flat"><a:solidFill>${createColorElement(opts.dataBorder.color)}</a:solidFill><a:prstDash val="solid"/><a:round/></a:ln>`;
        }
        strXml += createShadowElement(opts.shadow, DEF_SHAPE_SHADOW);
        strXml += "  </c:spPr>";
        strXml += "</c:dPt>";
      });
      strXml += "<c:dLbls>";
      optsChartData.labels[0].forEach((_label, idx) => {
        strXml += "<c:dLbl>";
        strXml += ` <c:idx val="${idx}"/>`;
        strXml += `  <c:numFmt formatCode="${encodeXmlEntities(opts.dataLabelFormatCode) || "General"}" sourceLinked="0"/>`;
        strXml += "  <c:spPr/><c:txPr>";
        strXml += "   <a:bodyPr/><a:lstStyle/>";
        strXml += "   <a:p><a:pPr>";
        strXml += `   <a:defRPr sz="${Math.round((opts.dataLabelFontSize || DEF_FONT_SIZE) * 100)}" b="${opts.dataLabelFontBold ? 1 : 0}" i="${opts.dataLabelFontItalic ? 1 : 0}" u="none" strike="noStrike">`;
        strXml += "    <a:solidFill>" + createColorElement(opts.dataLabelColor || DEF_FONT_COLOR) + "</a:solidFill>";
        strXml += `    <a:latin typeface="${opts.dataLabelFontFace || "Arial"}"/>`;
        strXml += "   </a:defRPr>";
        strXml += "      </a:pPr></a:p>";
        strXml += "    </c:txPr>";
        if (chartType === CHART_TYPE.PIE && opts.dataLabelPosition)
          strXml += `<c:dLblPos val="${opts.dataLabelPosition}"/>`;
        strXml += '    <c:showLegendKey val="0"/>';
        strXml += '    <c:showVal val="' + (opts.showValue ? "1" : "0") + '"/>';
        strXml += '    <c:showCatName val="' + (opts.showLabel ? "1" : "0") + '"/>';
        strXml += '    <c:showSerName val="' + (opts.showSerName ? "1" : "0") + '"/>';
        strXml += '    <c:showPercent val="' + (opts.showPercent ? "1" : "0") + '"/>';
        strXml += '    <c:showBubbleSize val="0"/>';
        strXml += "  </c:dLbl>";
      });
      strXml += ` <c:numFmt formatCode="${encodeXmlEntities(opts.dataLabelFormatCode) || "General"}" sourceLinked="0"/>`;
      strXml += "    <c:txPr>";
      strXml += "      <a:bodyPr/>";
      strXml += "      <a:lstStyle/>";
      strXml += "      <a:p>";
      strXml += "        <a:pPr>";
      strXml += `          <a:defRPr sz="1800" b="${opts.dataLabelFontBold ? "1" : "0"}" i="${opts.dataLabelFontItalic ? "1" : "0"}" u="none" strike="noStrike">`;
      strXml += '            <a:solidFill><a:srgbClr val="000000"/></a:solidFill><a:latin typeface="Arial"/>';
      strXml += "          </a:defRPr>";
      strXml += "        </a:pPr>";
      strXml += "      </a:p>";
      strXml += "    </c:txPr>";
      strXml += chartType === CHART_TYPE.PIE ? '<c:dLblPos val="ctr"/>' : "";
      strXml += '    <c:showLegendKey val="0"/>';
      strXml += '    <c:showVal val="0"/>';
      strXml += '    <c:showCatName val="1"/>';
      strXml += '    <c:showSerName val="0"/>';
      strXml += '    <c:showPercent val="1"/>';
      strXml += '    <c:showBubbleSize val="0"/>';
      strXml += ` <c:showLeaderLines val="${opts.showLeaderLines ? "1" : "0"}"/>`;
      strXml += "</c:dLbls>";
      strXml += "<c:cat>";
      strXml += "  <c:strRef>";
      strXml += `    <c:f>Sheet1!$A$2:$A$${optsChartData.labels[0].length + 1}</c:f>`;
      strXml += "    <c:strCache>";
      strXml += `         <c:ptCount val="${optsChartData.labels[0].length}"/>`;
      optsChartData.labels[0].forEach((label, idx) => {
        strXml += `<c:pt idx="${idx}"><c:v>${encodeXmlEntities(label)}</c:v></c:pt>`;
      });
      strXml += "    </c:strCache>";
      strXml += "  </c:strRef>";
      strXml += "</c:cat>";
      strXml += "  <c:val>";
      strXml += "    <c:numRef>";
      strXml += `      <c:f>Sheet1!$B$2:$B$${optsChartData.labels[0].length + 1}</c:f>`;
      strXml += "      <c:numCache>";
      strXml += `           <c:ptCount val="${optsChartData.labels[0].length}"/>`;
      optsChartData.values.forEach((value, idx) => {
        strXml += `<c:pt idx="${idx}"><c:v>${value || value === 0 ? value : ""}</c:v></c:pt>`;
      });
      strXml += "      </c:numCache>";
      strXml += "    </c:numRef>";
      strXml += "  </c:val>";
      strXml += "  </c:ser>";
      strXml += `  <c:firstSliceAng val="${opts.firstSliceAng ? Math.round(opts.firstSliceAng) : 0}"/>`;
      if (chartType === CHART_TYPE.DOUGHNUT)
        strXml += `<c:holeSize val="${typeof opts.holeSize === "number" ? opts.holeSize : "50"}"/>`;
      strXml += "</c:" + chartType + "Chart>";
      break;
    default:
      strXml += "";
      break;
  }
  return strXml;
}
function makeCatAxis(opts, axisId, valAxisId) {
  let strXml = "";
  if (opts._type === CHART_TYPE.SCATTER || opts._type === CHART_TYPE.BUBBLE || opts._type === CHART_TYPE.BUBBLE3D) {
    strXml += "<c:valAx>";
  } else {
    strXml += "<c:" + (opts.catLabelFormatCode ? "dateAx" : "catAx") + ">";
  }
  strXml += '  <c:axId val="' + axisId + '"/>';
  strXml += "  <c:scaling>";
  strXml += '<c:orientation val="' + (opts.catAxisOrientation || (opts.barDir === "col" ? "minMax" : "minMax")) + '"/>';
  if (opts.catAxisMaxVal || opts.catAxisMaxVal === 0)
    strXml += `<c:max val="${opts.catAxisMaxVal}"/>`;
  if (opts.catAxisMinVal || opts.catAxisMinVal === 0)
    strXml += `<c:min val="${opts.catAxisMinVal}"/>`;
  strXml += "</c:scaling>";
  strXml += '  <c:delete val="' + (opts.catAxisHidden ? "1" : "0") + '"/>';
  strXml += '  <c:axPos val="' + (opts.barDir === "col" ? "b" : "l") + '"/>';
  strXml += opts.catGridLine.style !== "none" ? createGridLineElement(opts.catGridLine) : "";
  if (opts.showCatAxisTitle) {
    strXml += genXmlTitle({
      color: opts.catAxisTitleColor,
      fontFace: opts.catAxisTitleFontFace,
      fontSize: opts.catAxisTitleFontSize,
      titleRotate: opts.catAxisTitleRotate,
      title: opts.catAxisTitle || "Axis Title"
    });
  }
  if (opts._type === CHART_TYPE.SCATTER || opts._type === CHART_TYPE.BUBBLE || opts._type === CHART_TYPE.BUBBLE3D) {
    strXml += '  <c:numFmt formatCode="' + (opts.valAxisLabelFormatCode ? encodeXmlEntities(opts.valAxisLabelFormatCode) : "General") + '" sourceLinked="1"/>';
  } else {
    strXml += '  <c:numFmt formatCode="' + (encodeXmlEntities(opts.catLabelFormatCode) || "General") + '" sourceLinked="1"/>';
  }
  if (opts._type === CHART_TYPE.SCATTER) {
    strXml += '  <c:majorTickMark val="none"/>';
    strXml += '  <c:minorTickMark val="none"/>';
    strXml += '  <c:tickLblPos val="nextTo"/>';
  } else {
    strXml += '  <c:majorTickMark val="' + (opts.catAxisMajorTickMark || "out") + '"/>';
    strXml += '  <c:minorTickMark val="' + (opts.catAxisMinorTickMark || "none") + '"/>';
    strXml += '  <c:tickLblPos val="' + (opts.catAxisLabelPos || (opts.barDir === "col" ? "low" : "nextTo")) + '"/>';
  }
  strXml += "  <c:spPr>";
  strXml += `    <a:ln w="${opts.catAxisLineSize ? valToPts(opts.catAxisLineSize) : ONEPT}" cap="flat">`;
  strXml += !opts.catAxisLineShow ? "<a:noFill/>" : "<a:solidFill>" + createColorElement(opts.catAxisLineColor || DEF_CHART_GRIDLINE.color) + "</a:solidFill>";
  strXml += '      <a:prstDash val="' + (opts.catAxisLineStyle || "solid") + '"/>';
  strXml += "      <a:round/>";
  strXml += "    </a:ln>";
  strXml += "  </c:spPr>";
  strXml += "  <c:txPr>";
  if (opts.catAxisLabelRotate) {
    strXml += `<a:bodyPr rot="${convertRotationDegrees(opts.catAxisLabelRotate)}"/>`;
  } else {
    strXml += "<a:bodyPr/>";
  }
  strXml += "    <a:lstStyle/>";
  strXml += "    <a:p>";
  strXml += "    <a:pPr>";
  strXml += `      <a:defRPr sz="${Math.round((opts.catAxisLabelFontSize || DEF_FONT_SIZE) * 100)}" b="${opts.catAxisLabelFontBold ? 1 : 0}" i="${opts.catAxisLabelFontItalic ? 1 : 0}" u="none" strike="noStrike">`;
  strXml += "      <a:solidFill>" + createColorElement(opts.catAxisLabelColor || DEF_FONT_COLOR) + "</a:solidFill>";
  strXml += '      <a:latin typeface="' + (opts.catAxisLabelFontFace || "Arial") + '"/>';
  strXml += "   </a:defRPr>";
  strXml += "  </a:pPr>";
  strXml += '  <a:endParaRPr lang="' + (opts.lang || "en-US") + '"/>';
  strXml += "  </a:p>";
  strXml += " </c:txPr>";
  strXml += ' <c:crossAx val="' + valAxisId + '"/>';
  strXml += ` <c:${typeof opts.valAxisCrossesAt === "number" ? "crossesAt" : "crosses"} val="${opts.valAxisCrossesAt || "autoZero"}"/>`;
  strXml += ' <c:auto val="1"/>';
  strXml += ' <c:lblAlgn val="ctr"/>';
  strXml += ` <c:noMultiLvlLbl val="${opts.catAxisMultiLevelLabels ? 0 : 1}"/>`;
  if (opts.catAxisLabelFrequency)
    strXml += ' <c:tickLblSkip val="' + opts.catAxisLabelFrequency + '"/>';
  if (opts.catLabelFormatCode || opts._type === CHART_TYPE.SCATTER || opts._type === CHART_TYPE.BUBBLE || opts._type === CHART_TYPE.BUBBLE3D) {
    if (opts.catLabelFormatCode) {
      ["catAxisBaseTimeUnit", "catAxisMajorTimeUnit", "catAxisMinorTimeUnit"].forEach((opt) => {
        if (opts[opt] && (typeof opts[opt] !== "string" || !["days", "months", "years"].includes(opts[opt].toLowerCase()))) {
          console.warn(`"${opt}" must be one of: 'days','months','years' !`);
          opts[opt] = null;
        }
      });
      if (opts.catAxisBaseTimeUnit)
        strXml += '<c:baseTimeUnit val="' + opts.catAxisBaseTimeUnit.toLowerCase() + '"/>';
      if (opts.catAxisMajorTimeUnit)
        strXml += '<c:majorTimeUnit val="' + opts.catAxisMajorTimeUnit.toLowerCase() + '"/>';
      if (opts.catAxisMinorTimeUnit)
        strXml += '<c:minorTimeUnit val="' + opts.catAxisMinorTimeUnit.toLowerCase() + '"/>';
    }
    if (opts.catAxisMajorUnit)
      strXml += `<c:majorUnit val="${opts.catAxisMajorUnit}"/>`;
    if (opts.catAxisMinorUnit)
      strXml += `<c:minorUnit val="${opts.catAxisMinorUnit}"/>`;
  }
  if (opts._type === CHART_TYPE.SCATTER || opts._type === CHART_TYPE.BUBBLE || opts._type === CHART_TYPE.BUBBLE3D) {
    strXml += "</c:valAx>";
  } else {
    strXml += "</c:" + (opts.catLabelFormatCode ? "dateAx" : "catAx") + ">";
  }
  return strXml;
}
function makeValAxis(opts, valAxisId) {
  let axisPos = valAxisId === AXIS_ID_VALUE_PRIMARY ? opts.barDir === "col" ? "l" : "b" : opts.barDir !== "col" ? "r" : "t";
  if (valAxisId === AXIS_ID_VALUE_SECONDARY)
    axisPos = "r";
  const crossAxId = valAxisId === AXIS_ID_VALUE_PRIMARY ? AXIS_ID_CATEGORY_PRIMARY : AXIS_ID_CATEGORY_SECONDARY;
  let strXml = "";
  strXml += "<c:valAx>";
  strXml += '  <c:axId val="' + valAxisId + '"/>';
  strXml += "  <c:scaling>";
  if (opts.valAxisLogScaleBase)
    strXml += `<c:logBase val="${opts.valAxisLogScaleBase}"/>`;
  strXml += '<c:orientation val="' + (opts.valAxisOrientation || (opts.barDir === "col" ? "minMax" : "minMax")) + '"/>';
  if (opts.valAxisMaxVal || opts.valAxisMaxVal === 0)
    strXml += `<c:max val="${opts.valAxisMaxVal}"/>`;
  if (opts.valAxisMinVal || opts.valAxisMinVal === 0)
    strXml += `<c:min val="${opts.valAxisMinVal}"/>`;
  strXml += "  </c:scaling>";
  strXml += `  <c:delete val="${opts.valAxisHidden ? 1 : 0}"/>`;
  strXml += '  <c:axPos val="' + axisPos + '"/>';
  if (opts.valGridLine.style !== "none")
    strXml += createGridLineElement(opts.valGridLine);
  if (opts.showValAxisTitle) {
    strXml += genXmlTitle({
      color: opts.valAxisTitleColor,
      fontFace: opts.valAxisTitleFontFace,
      fontSize: opts.valAxisTitleFontSize,
      titleRotate: opts.valAxisTitleRotate,
      title: opts.valAxisTitle || "Axis Title"
    });
  }
  strXml += `<c:numFmt formatCode="${opts.valAxisLabelFormatCode ? encodeXmlEntities(opts.valAxisLabelFormatCode) : "General"}" sourceLinked="0"/>`;
  if (opts._type === CHART_TYPE.SCATTER) {
    strXml += '  <c:majorTickMark val="none"/>';
    strXml += '  <c:minorTickMark val="none"/>';
    strXml += '  <c:tickLblPos val="nextTo"/>';
  } else {
    strXml += ' <c:majorTickMark val="' + (opts.valAxisMajorTickMark || "out") + '"/>';
    strXml += ' <c:minorTickMark val="' + (opts.valAxisMinorTickMark || "none") + '"/>';
    strXml += ' <c:tickLblPos val="' + (opts.valAxisLabelPos || (opts.barDir === "col" ? "nextTo" : "low")) + '"/>';
  }
  strXml += " <c:spPr>";
  strXml += `   <a:ln w="${opts.valAxisLineSize ? valToPts(opts.valAxisLineSize) : ONEPT}" cap="flat">`;
  strXml += !opts.valAxisLineShow ? "<a:noFill/>" : "<a:solidFill>" + createColorElement(opts.valAxisLineColor || DEF_CHART_GRIDLINE.color) + "</a:solidFill>";
  strXml += '     <a:prstDash val="' + (opts.valAxisLineStyle || "solid") + '"/>';
  strXml += "     <a:round/>";
  strXml += "   </a:ln>";
  strXml += " </c:spPr>";
  strXml += " <c:txPr>";
  strXml += `  <a:bodyPr${opts.valAxisLabelRotate ? ' rot="' + convertRotationDegrees(opts.valAxisLabelRotate).toString() + '"' : ""}/>`;
  strXml += "  <a:lstStyle/>";
  strXml += "  <a:p>";
  strXml += "    <a:pPr>";
  strXml += `      <a:defRPr sz="${Math.round((opts.valAxisLabelFontSize || DEF_FONT_SIZE) * 100)}" b="${opts.valAxisLabelFontBold ? 1 : 0}" i="${opts.valAxisLabelFontItalic ? 1 : 0}" u="none" strike="noStrike">`;
  strXml += "        <a:solidFill>" + createColorElement(opts.valAxisLabelColor || DEF_FONT_COLOR) + "</a:solidFill>";
  strXml += '        <a:latin typeface="' + (opts.valAxisLabelFontFace || "Arial") + '"/>';
  strXml += "      </a:defRPr>";
  strXml += "    </a:pPr>";
  strXml += '  <a:endParaRPr lang="' + (opts.lang || "en-US") + '"/>';
  strXml += "  </a:p>";
  strXml += " </c:txPr>";
  strXml += ' <c:crossAx val="' + crossAxId + '"/>';
  if (typeof opts.catAxisCrossesAt === "number") {
    strXml += ` <c:crossesAt val="${opts.catAxisCrossesAt}"/>`;
  } else if (typeof opts.catAxisCrossesAt === "string") {
    strXml += ' <c:crosses val="' + opts.catAxisCrossesAt + '"/>';
  } else {
    const isRight = axisPos === "r" || axisPos === "t";
    const crosses = isRight ? "max" : "autoZero";
    strXml += ' <c:crosses val="' + crosses + '"/>';
  }
  strXml += ' <c:crossBetween val="' + (opts._type === CHART_TYPE.SCATTER || !!(Array.isArray(opts._type) && opts._type.filter((type) => type.type === CHART_TYPE.AREA).length > 0) ? "midCat" : "between") + '"/>';
  if (opts.valAxisMajorUnit)
    strXml += ` <c:majorUnit val="${opts.valAxisMajorUnit}"/>`;
  if (opts.valAxisDisplayUnit) {
    strXml += `<c:dispUnits><c:builtInUnit val="${opts.valAxisDisplayUnit}"/>${opts.valAxisDisplayUnitLabel ? "<c:dispUnitsLbl/>" : ""}</c:dispUnits>`;
  }
  strXml += "</c:valAx>";
  return strXml;
}
function makeSerAxis(opts, axisId, valAxisId) {
  let strXml = "";
  strXml += "<c:serAx>";
  strXml += '  <c:axId val="' + axisId + '"/>';
  strXml += '  <c:scaling><c:orientation val="' + (opts.serAxisOrientation || (opts.barDir === "col" ? "minMax" : "minMax")) + '"/></c:scaling>';
  strXml += '  <c:delete val="' + (opts.serAxisHidden ? "1" : "0") + '"/>';
  strXml += '  <c:axPos val="' + (opts.barDir === "col" ? "b" : "l") + '"/>';
  strXml += opts.serGridLine.style !== "none" ? createGridLineElement(opts.serGridLine) : "";
  if (opts.showSerAxisTitle) {
    strXml += genXmlTitle({
      color: opts.serAxisTitleColor,
      fontFace: opts.serAxisTitleFontFace,
      fontSize: opts.serAxisTitleFontSize,
      titleRotate: opts.serAxisTitleRotate,
      title: opts.serAxisTitle || "Axis Title"
    });
  }
  strXml += `  <c:numFmt formatCode="${encodeXmlEntities(opts.serLabelFormatCode) || "General"}" sourceLinked="0"/>`;
  strXml += '  <c:majorTickMark val="out"/>';
  strXml += '  <c:minorTickMark val="none"/>';
  strXml += `  <c:tickLblPos val="${opts.serAxisLabelPos || opts.barDir === "col" ? "low" : "nextTo"}"/>`;
  strXml += "  <c:spPr>";
  strXml += '    <a:ln w="12700" cap="flat">';
  strXml += !opts.serAxisLineShow ? "<a:noFill/>" : `<a:solidFill>${createColorElement(opts.serAxisLineColor || DEF_CHART_GRIDLINE.color)}</a:solidFill>`;
  strXml += '      <a:prstDash val="solid"/>';
  strXml += "      <a:round/>";
  strXml += "    </a:ln>";
  strXml += "  </c:spPr>";
  strXml += "  <c:txPr>";
  strXml += "    <a:bodyPr/>";
  strXml += "    <a:lstStyle/>";
  strXml += "    <a:p>";
  strXml += "    <a:pPr>";
  strXml += `    <a:defRPr sz="${Math.round((opts.serAxisLabelFontSize || DEF_FONT_SIZE) * 100)}" b="${opts.serAxisLabelFontBold ? "1" : "0"}" i="${opts.serAxisLabelFontItalic ? "1" : "0"}" u="none" strike="noStrike">`;
  strXml += `      <a:solidFill>${createColorElement(opts.serAxisLabelColor || DEF_FONT_COLOR)}</a:solidFill>`;
  strXml += `      <a:latin typeface="${opts.serAxisLabelFontFace || "Arial"}"/>`;
  strXml += "   </a:defRPr>";
  strXml += "  </a:pPr>";
  strXml += '  <a:endParaRPr lang="' + (opts.lang || "en-US") + '"/>';
  strXml += "  </a:p>";
  strXml += " </c:txPr>";
  strXml += ' <c:crossAx val="' + valAxisId + '"/>';
  strXml += ' <c:crosses val="autoZero"/>';
  if (opts.serAxisLabelFrequency)
    strXml += ' <c:tickLblSkip val="' + opts.serAxisLabelFrequency + '"/>';
  if (opts.serLabelFormatCode) {
    ["serAxisBaseTimeUnit", "serAxisMajorTimeUnit", "serAxisMinorTimeUnit"].forEach((opt) => {
      if (opts[opt] && (typeof opts[opt] !== "string" || !["days", "months", "years"].includes(opt.toLowerCase()))) {
        console.warn(`"${opt}" must be one of: 'days','months','years' !`);
        opts[opt] = null;
      }
    });
    if (opts.serAxisBaseTimeUnit)
      strXml += ` <c:baseTimeUnit  val="${opts.serAxisBaseTimeUnit.toLowerCase()}"/>`;
    if (opts.serAxisMajorTimeUnit)
      strXml += ` <c:majorTimeUnit val="${opts.serAxisMajorTimeUnit.toLowerCase()}"/>`;
    if (opts.serAxisMinorTimeUnit)
      strXml += ` <c:minorTimeUnit val="${opts.serAxisMinorTimeUnit.toLowerCase()}"/>`;
    if (opts.serAxisMajorUnit)
      strXml += ` <c:majorUnit val="${opts.serAxisMajorUnit}"/>`;
    if (opts.serAxisMinorUnit)
      strXml += ` <c:minorUnit val="${opts.serAxisMinorUnit}"/>`;
  }
  strXml += "</c:serAx>";
  return strXml;
}
function genXmlTitle(opts, chartX, chartY) {
  const align = opts.titleAlign === "left" || opts.titleAlign === "right" ? `<a:pPr algn="${opts.titleAlign.substring(0, 1)}">` : "<a:pPr>";
  const rotate = opts.titleRotate ? `<a:bodyPr rot="${convertRotationDegrees(opts.titleRotate)}"/>` : "<a:bodyPr/>";
  const sizeAttr = opts.fontSize ? `sz="${Math.round(opts.fontSize * 100)}"` : "";
  const titleBold = opts.titleBold ? 1 : 0;
  let layout = "<c:layout/>";
  if (opts.titlePos && typeof opts.titlePos.x === "number" && typeof opts.titlePos.y === "number") {
    const totalX = opts.titlePos.x + chartX;
    const totalY = opts.titlePos.y + chartY;
    let valX = totalX === 0 ? 0 : totalX * (totalX / 5) / 10;
    if (valX >= 1)
      valX = valX / 10;
    if (valX >= 0.1)
      valX = valX / 10;
    let valY = totalY === 0 ? 0 : totalY * (totalY / 5) / 10;
    if (valY >= 1)
      valY = valY / 10;
    if (valY >= 0.1)
      valY = valY / 10;
    layout = `<c:layout><c:manualLayout><c:xMode val="edge"/><c:yMode val="edge"/><c:x val="${valX}"/><c:y val="${valY}"/></c:manualLayout></c:layout>`;
  }
  return `<c:title>
      <c:tx>
        <c:rich>
          ${rotate}
          <a:lstStyle/>
          <a:p>
            ${align}
            <a:defRPr ${sizeAttr} b="${titleBold}" i="0" u="none" strike="noStrike">
              <a:solidFill>${createColorElement(opts.color || DEF_FONT_COLOR)}</a:solidFill>
              <a:latin typeface="${opts.fontFace || "Arial"}"/>
            </a:defRPr>
          </a:pPr>
          <a:r>
            <a:rPr ${sizeAttr} b="${titleBold}" i="0" u="none" strike="noStrike">
              <a:solidFill>${createColorElement(opts.color || DEF_FONT_COLOR)}</a:solidFill>
              <a:latin typeface="${opts.fontFace || "Arial"}"/>
            </a:rPr>
            <a:t>${encodeXmlEntities(opts.title) || ""}</a:t>
          </a:r>
        </a:p>
        </c:rich>
      </c:tx>
      ${layout}
      <c:overlay val="0"/>
    </c:title>`;
}
function getExcelColName(colIndex) {
  let colStr = "";
  const colIdx = colIndex - 1;
  if (colIdx <= 25) {
    colStr = LETTERS[colIdx];
  } else {
    colStr = `${LETTERS[Math.floor(colIdx / LETTERS.length - 1)]}${LETTERS[colIdx % LETTERS.length]}`;
  }
  return colStr;
}
function createShadowElement(options, defaults) {
  if (!options) {
    return "<a:effectLst/>";
  } else if (typeof options !== "object") {
    console.warn("`shadow` options must be an object. Ex: `{shadow: {type:'none'}}`");
    return "<a:effectLst/>";
  }
  let strXml = "<a:effectLst>";
  const opts = Object.assign(Object.assign({}, defaults), options);
  const type = opts.type || "outer";
  const blur = valToPts(opts.blur);
  const offset = valToPts(opts.offset);
  const angle = Math.round(opts.angle * 6e4);
  const color = opts.color;
  const opacity = Math.round(opts.opacity * 1e5);
  const rotShape = opts.rotateWithShape ? 1 : 0;
  strXml += `<a:${type}Shdw sx="100000" sy="100000" kx="0" ky="0"  algn="bl" blurRad="${blur}" rotWithShape="${rotShape}" dist="${offset}" dir="${angle}">`;
  strXml += `<a:srgbClr val="${color}">`;
  strXml += `<a:alpha val="${opacity}"/></a:srgbClr>`;
  strXml += `</a:${type}Shdw>`;
  strXml += "</a:effectLst>";
  return strXml;
}
function createGridLineElement(glOpts) {
  let strXml = "<c:majorGridlines>";
  strXml += " <c:spPr>";
  strXml += `  <a:ln w="${valToPts(glOpts.size || DEF_CHART_GRIDLINE.size)}" cap="${createLineCap(glOpts.cap || DEF_CHART_GRIDLINE.cap)}">`;
  strXml += '  <a:solidFill><a:srgbClr val="' + (glOpts.color || DEF_CHART_GRIDLINE.color) + '"/></a:solidFill>';
  strXml += '   <a:prstDash val="' + (glOpts.style || DEF_CHART_GRIDLINE.style) + '"/><a:round/>';
  strXml += "  </a:ln>";
  strXml += " </c:spPr>";
  strXml += "</c:majorGridlines>";
  return strXml;
}
function createLineCap(lineCap) {
  if (!lineCap || lineCap === "flat") {
    return "flat";
  } else if (lineCap === "square") {
    return "sq";
  } else if (lineCap === "round") {
    return "rnd";
  } else {
    const neverLineCap = lineCap;
    throw new Error(`Invalid chart line cap: ${neverLineCap}`);
  }
}
function encodeSlideMediaRels(layout) {
  var _a, _b;
  const isNode = typeof process !== "undefined" && !!((_a = process.versions) === null || _a === void 0 ? void 0 : _a.node) && ((_b = process.release) === null || _b === void 0 ? void 0 : _b.name) === "node";
  let fs;
  let https;
  const loadNodeDeps = isNode ? () => __awaiter(this, void 0, void 0, function* () {
    ({ default: fs } = yield Promise.resolve().then(() => __toESM(require_node_fs())));
    ({ default: https } = yield Promise.resolve().then(() => __toESM(require_node_https())));
  }) : () => __awaiter(this, void 0, void 0, function* () {
  });
  if (isNode)
    loadNodeDeps();
  const imageProms = [];
  const candidateRels = layout._relsMedia.filter((rel) => rel.type !== "online" && !rel.data && (!rel.path || rel.path && !rel.path.includes("preencoded")));
  const unqPaths = [];
  candidateRels.forEach((rel) => {
    if (!unqPaths.includes(rel.path)) {
      rel.isDuplicate = false;
      unqPaths.push(rel.path);
    } else {
      rel.isDuplicate = true;
    }
  });
  candidateRels.filter((rel) => !rel.isDuplicate).forEach((rel) => {
    imageProms.push((() => __awaiter(this, void 0, void 0, function* () {
      if (!https)
        yield loadNodeDeps();
      if (isNode && fs && rel.path.indexOf("http") !== 0) {
        try {
          const bitmap = fs.readFileSync(rel.path);
          rel.data = Buffer.from(bitmap).toString("base64");
          candidateRels.filter((dupe) => dupe.isDuplicate && dupe.path === rel.path).forEach((dupe) => dupe.data = rel.data);
          return "done";
        } catch (ex) {
          rel.data = IMG_BROKEN;
          candidateRels.filter((dupe) => dupe.isDuplicate && dupe.path === rel.path).forEach((dupe) => dupe.data = rel.data);
          throw new Error(`ERROR: Unable to read media: "${rel.path}"
${String(ex)}`);
        }
      }
      if (isNode && https && rel.path.startsWith("http")) {
        return yield new Promise((resolve, reject) => {
          https.get(rel.path, (res) => {
            let raw = "";
            res.setEncoding("binary");
            res.on("data", (chunk) => raw += chunk);
            res.on("end", () => {
              rel.data = Buffer.from(raw, "binary").toString("base64");
              candidateRels.filter((dupe) => dupe.isDuplicate && dupe.path === rel.path).forEach((dupe) => dupe.data = rel.data);
              resolve("done");
            });
            res.on("error", () => {
              rel.data = IMG_BROKEN;
              candidateRels.filter((dupe) => dupe.isDuplicate && dupe.path === rel.path).forEach((dupe) => dupe.data = rel.data);
              reject(new Error(`ERROR! Unable to load image (https.get): ${rel.path}`));
            });
          });
        });
      }
      return yield new Promise((resolve, reject) => {
        const xhr = new XMLHttpRequest();
        xhr.onload = () => {
          const reader = new FileReader();
          reader.onloadend = () => {
            rel.data = reader.result;
            candidateRels.filter((dupe) => dupe.isDuplicate && dupe.path === rel.path).forEach((dupe) => dupe.data = rel.data);
            if (!rel.isSvgPng) {
              resolve("done");
            } else {
              createSvgPngPreview(rel).then(() => resolve("done")).catch(reject);
            }
          };
          reader.readAsDataURL(xhr.response);
        };
        xhr.onerror = () => {
          rel.data = IMG_BROKEN;
          candidateRels.filter((dupe) => dupe.isDuplicate && dupe.path === rel.path).forEach((dupe) => dupe.data = rel.data);
          reject(new Error(`ERROR! Unable to load image (xhr.onerror): ${rel.path}`));
        };
        xhr.open("GET", rel.path);
        xhr.responseType = "blob";
        xhr.send();
      });
    }))());
  });
  layout._relsMedia.filter((rel) => rel.isSvgPng && rel.data).forEach((rel) => {
    (() => __awaiter(this, void 0, void 0, function* () {
      if (isNode && !fs)
        yield loadNodeDeps();
      if (isNode && fs) {
        rel.data = IMG_BROKEN;
        imageProms.push(Promise.resolve("done"));
      } else {
        imageProms.push(createSvgPngPreview(rel));
      }
    }))();
  });
  return imageProms;
}
function createSvgPngPreview(rel) {
  return __awaiter(this, void 0, void 0, function* () {
    return yield new Promise((resolve, reject) => {
      const image = new Image();
      image.onload = () => {
        if (image.width + image.height === 0) {
          image.onerror("h/w=0");
        }
        let canvas = document.createElement("CANVAS");
        const ctx = canvas.getContext("2d");
        canvas.width = image.width;
        canvas.height = image.height;
        ctx.drawImage(image, 0, 0);
        try {
          rel.data = canvas.toDataURL(rel.type);
          resolve("done");
        } catch (ex) {
          image.onerror(ex.toString());
        }
        canvas = null;
      };
      image.onerror = () => {
        rel.data = IMG_BROKEN;
        reject(new Error(`ERROR! Unable to load image (image.onerror): ${rel.path}`));
      };
      image.src = typeof rel.data === "string" ? rel.data : IMG_BROKEN;
    });
  });
}
var ImageSizingXml = {
  cover: function(imgSize, boxDim) {
    const imgRatio = imgSize.h / imgSize.w;
    const boxRatio = boxDim.h / boxDim.w;
    const isBoxBased = boxRatio > imgRatio;
    const width = isBoxBased ? boxDim.h / imgRatio : boxDim.w;
    const height = isBoxBased ? boxDim.h : boxDim.w * imgRatio;
    const hzPerc = Math.round(1e5 * 0.5 * (1 - boxDim.w / width));
    const vzPerc = Math.round(1e5 * 0.5 * (1 - boxDim.h / height));
    return `<a:srcRect l="${hzPerc}" r="${hzPerc}" t="${vzPerc}" b="${vzPerc}"/><a:stretch/>`;
  },
  contain: function(imgSize, boxDim) {
    const imgRatio = imgSize.h / imgSize.w;
    const boxRatio = boxDim.h / boxDim.w;
    const widthBased = boxRatio > imgRatio;
    const width = widthBased ? boxDim.w : boxDim.h / imgRatio;
    const height = widthBased ? boxDim.w * imgRatio : boxDim.h;
    const hzPerc = Math.round(1e5 * 0.5 * (1 - boxDim.w / width));
    const vzPerc = Math.round(1e5 * 0.5 * (1 - boxDim.h / height));
    return `<a:srcRect l="${hzPerc}" r="${hzPerc}" t="${vzPerc}" b="${vzPerc}"/><a:stretch/>`;
  },
  crop: function(imgSize, boxDim) {
    const l = boxDim.x;
    const r = imgSize.w - (boxDim.x + boxDim.w);
    const t = boxDim.y;
    const b = imgSize.h - (boxDim.y + boxDim.h);
    const lPerc = Math.round(1e5 * (l / imgSize.w));
    const rPerc = Math.round(1e5 * (r / imgSize.w));
    const tPerc = Math.round(1e5 * (t / imgSize.h));
    const bPerc = Math.round(1e5 * (b / imgSize.h));
    return `<a:srcRect l="${lPerc}" r="${rPerc}" t="${tPerc}" b="${bPerc}"/><a:stretch/>`;
  }
};
function slideObjectToXml(slide) {
  var _a;
  let strSlideXml = slide._name ? '<p:cSld name="' + slide._name + '">' : "<p:cSld>";
  let intTableNum = 1;
  if (slide._bkgdImgRid) {
    strSlideXml += `<p:bg><p:bgPr><a:blipFill dpi="0" rotWithShape="1"><a:blip r:embed="rId${slide._bkgdImgRid}"><a:lum/></a:blip><a:srcRect/><a:stretch><a:fillRect/></a:stretch></a:blipFill><a:effectLst/></p:bgPr></p:bg>`;
  } else if ((_a = slide.background) === null || _a === void 0 ? void 0 : _a.color) {
    strSlideXml += `<p:bg><p:bgPr>${genXmlColorSelection(slide.background)}</p:bgPr></p:bg>`;
  } else if (!slide.bkgd && slide._name && slide._name === DEF_PRES_LAYOUT_NAME) {
    strSlideXml += '<p:bg><p:bgRef idx="1001"><a:schemeClr val="bg1"/></p:bgRef></p:bg>';
  }
  strSlideXml += "<p:spTree>";
  strSlideXml += '<p:nvGrpSpPr><p:cNvPr id="1" name=""/><p:cNvGrpSpPr/><p:nvPr/></p:nvGrpSpPr>';
  strSlideXml += '<p:grpSpPr><a:xfrm><a:off x="0" y="0"/><a:ext cx="0" cy="0"/>';
  strSlideXml += '<a:chOff x="0" y="0"/><a:chExt cx="0" cy="0"/></a:xfrm></p:grpSpPr>';
  slide._slideObjects.forEach((slideItemObj, idx) => {
    var _a2, _b, _c, _d, _e, _f, _g, _h;
    let x = 0;
    let y = 0;
    let cx = getSmartParseNumber("75%", "X", slide._presLayout);
    let cy = 0;
    let placeholderObj;
    let locationAttr = "";
    let arrTabRows = null;
    let objTabOpts = null;
    let intColCnt = 0;
    let intColW = 0;
    let cellOpts = null;
    let strXml = null;
    const sizing = (_a2 = slideItemObj.options) === null || _a2 === void 0 ? void 0 : _a2.sizing;
    const rounding = (_b = slideItemObj.options) === null || _b === void 0 ? void 0 : _b.rounding;
    if (slide._slideLayout !== void 0 && slide._slideLayout._slideObjects !== void 0 && slideItemObj.options && slideItemObj.options.placeholder) {
      placeholderObj = slide._slideLayout._slideObjects.filter((object) => object.options.placeholder === slideItemObj.options.placeholder)[0];
    }
    slideItemObj.options = slideItemObj.options || {};
    if (typeof slideItemObj.options.x !== "undefined")
      x = getSmartParseNumber(slideItemObj.options.x, "X", slide._presLayout);
    if (typeof slideItemObj.options.y !== "undefined")
      y = getSmartParseNumber(slideItemObj.options.y, "Y", slide._presLayout);
    if (typeof slideItemObj.options.w !== "undefined")
      cx = getSmartParseNumber(slideItemObj.options.w, "X", slide._presLayout);
    if (typeof slideItemObj.options.h !== "undefined")
      cy = getSmartParseNumber(slideItemObj.options.h, "Y", slide._presLayout);
    let imgWidth = cx;
    let imgHeight = cy;
    if (placeholderObj) {
      if (placeholderObj.options.x || placeholderObj.options.x === 0)
        x = getSmartParseNumber(placeholderObj.options.x, "X", slide._presLayout);
      if (placeholderObj.options.y || placeholderObj.options.y === 0)
        y = getSmartParseNumber(placeholderObj.options.y, "Y", slide._presLayout);
      if (placeholderObj.options.w || placeholderObj.options.w === 0)
        cx = getSmartParseNumber(placeholderObj.options.w, "X", slide._presLayout);
      if (placeholderObj.options.h || placeholderObj.options.h === 0)
        cy = getSmartParseNumber(placeholderObj.options.h, "Y", slide._presLayout);
    }
    if (slideItemObj.options.flipH)
      locationAttr += ' flipH="1"';
    if (slideItemObj.options.flipV)
      locationAttr += ' flipV="1"';
    if (slideItemObj.options.rotate)
      locationAttr += ` rot="${convertRotationDegrees(slideItemObj.options.rotate)}"`;
    switch (slideItemObj._type) {
      case SLIDE_OBJECT_TYPES.table:
        arrTabRows = slideItemObj.arrTabRows;
        objTabOpts = slideItemObj.options;
        intColCnt = 0;
        intColW = 0;
        arrTabRows[0].forEach((cell) => {
          cellOpts = cell.options || null;
          intColCnt += (cellOpts === null || cellOpts === void 0 ? void 0 : cellOpts.colspan) ? Number(cellOpts.colspan) : 1;
        });
        strXml = `<p:graphicFrame><p:nvGraphicFramePr><p:cNvPr id="${intTableNum * slide._slideNum + 1}" name="${slideItemObj.options.objectName}"/>`;
        strXml += '<p:cNvGraphicFramePr><a:graphicFrameLocks noGrp="1"/></p:cNvGraphicFramePr>  <p:nvPr><p:extLst><p:ext uri="{D42A27DB-BD31-4B8C-83A1-F6EECF244321}"><p14:modId xmlns:p14="http://schemas.microsoft.com/office/powerpoint/2010/main" val="1579011935"/></p:ext></p:extLst></p:nvPr></p:nvGraphicFramePr>';
        strXml += `<p:xfrm><a:off x="${x || (x === 0 ? 0 : EMU)}" y="${y || (y === 0 ? 0 : EMU)}"/><a:ext cx="${cx || (cx === 0 ? 0 : EMU)}" cy="${cy || EMU}"/></p:xfrm>`;
        strXml += '<a:graphic><a:graphicData uri="http://schemas.openxmlformats.org/drawingml/2006/table"><a:tbl><a:tblPr/>';
        if (Array.isArray(objTabOpts.colW)) {
          strXml += "<a:tblGrid>";
          for (let col = 0; col < intColCnt; col++) {
            let w = inch2Emu(objTabOpts.colW[col]);
            if (w == null || isNaN(w)) {
              w = (typeof slideItemObj.options.w === "number" ? slideItemObj.options.w : 1) / intColCnt;
            }
            strXml += `<a:gridCol w="${Math.round(w)}"/>`;
          }
          strXml += "</a:tblGrid>";
        } else {
          intColW = objTabOpts.colW ? objTabOpts.colW : EMU;
          if (slideItemObj.options.w && !objTabOpts.colW)
            intColW = Math.round((typeof slideItemObj.options.w === "number" ? slideItemObj.options.w : 1) / intColCnt);
          strXml += "<a:tblGrid>";
          for (let colw = 0; colw < intColCnt; colw++) {
            strXml += `<a:gridCol w="${intColW}"/>`;
          }
          strXml += "</a:tblGrid>";
        }
        arrTabRows.forEach((cells) => {
          var _a3, _b2;
          for (let cIdx = 0; cIdx < cells.length; ) {
            const cell = cells[cIdx];
            const colspan = (_a3 = cell.options) === null || _a3 === void 0 ? void 0 : _a3.colspan;
            const rowspan = (_b2 = cell.options) === null || _b2 === void 0 ? void 0 : _b2.rowspan;
            if (colspan && colspan > 1) {
              const vMergeCells = new Array(colspan - 1).fill(void 0).map(() => {
                return { _type: SLIDE_OBJECT_TYPES.tablecell, options: { rowspan }, _hmerge: true };
              });
              cells.splice(cIdx + 1, 0, ...vMergeCells);
              cIdx += colspan;
            } else {
              cIdx += 1;
            }
          }
        });
        arrTabRows.forEach((cells, rIdx) => {
          const nextRow = arrTabRows[rIdx + 1];
          if (!nextRow)
            return;
          cells.forEach((cell, cIdx) => {
            var _a3, _b2;
            const rowspan = cell._rowContinue || ((_a3 = cell.options) === null || _a3 === void 0 ? void 0 : _a3.rowspan);
            const colspan = (_b2 = cell.options) === null || _b2 === void 0 ? void 0 : _b2.colspan;
            const _hmerge = cell._hmerge;
            if (rowspan && rowspan > 1) {
              const hMergeCell = { _type: SLIDE_OBJECT_TYPES.tablecell, options: { colspan }, _rowContinue: rowspan - 1, _vmerge: true, _hmerge };
              nextRow.splice(cIdx, 0, hMergeCell);
            }
          });
        });
        arrTabRows.forEach((cells, rIdx) => {
          let intRowH = 0;
          if (Array.isArray(objTabOpts.rowH) && objTabOpts.rowH[rIdx])
            intRowH = inch2Emu(Number(objTabOpts.rowH[rIdx]));
          else if (objTabOpts.rowH && !isNaN(Number(objTabOpts.rowH)))
            intRowH = inch2Emu(Number(objTabOpts.rowH));
          else if (slideItemObj.options.cy || slideItemObj.options.h) {
            intRowH = Math.round((slideItemObj.options.h ? inch2Emu(slideItemObj.options.h) : typeof slideItemObj.options.cy === "number" ? slideItemObj.options.cy : 1) / arrTabRows.length);
          }
          strXml += `<a:tr h="${intRowH}">`;
          cells.forEach((cellObj) => {
            var _a3, _b2, _c2, _d2, _e2;
            const cell = cellObj;
            const cellSpanAttrs = {
              rowSpan: ((_a3 = cell.options) === null || _a3 === void 0 ? void 0 : _a3.rowspan) > 1 ? cell.options.rowspan : void 0,
              gridSpan: ((_b2 = cell.options) === null || _b2 === void 0 ? void 0 : _b2.colspan) > 1 ? cell.options.colspan : void 0,
              vMerge: cell._vmerge ? 1 : void 0,
              hMerge: cell._hmerge ? 1 : void 0
            };
            let cellSpanAttrStr = Object.keys(cellSpanAttrs).map((k) => [k, cellSpanAttrs[k]]).filter(([, v]) => !!v).map(([k, v]) => `${String(k)}="${String(v)}"`).join(" ");
            if (cellSpanAttrStr)
              cellSpanAttrStr = " " + cellSpanAttrStr;
            if (cell._hmerge || cell._vmerge) {
              strXml += `<a:tc${cellSpanAttrStr}><a:tcPr/></a:tc>`;
              return;
            }
            const cellOpts2 = cell.options || {};
            cell.options = cellOpts2;
            ["align", "bold", "border", "color", "fill", "fontFace", "fontSize", "margin", "textDirection", "underline", "valign"].forEach((name) => {
              if (objTabOpts[name] && !cellOpts2[name] && cellOpts2[name] !== 0)
                cellOpts2[name] = objTabOpts[name];
            });
            const cellValign = cellOpts2.valign ? ` anchor="${cellOpts2.valign.replace(/^c$/i, "ctr").replace(/^m$/i, "ctr").replace("center", "ctr").replace("middle", "ctr").replace("top", "t").replace("btm", "b").replace("bottom", "b")}"` : "";
            const cellTextDir = cellOpts2.textDirection && cellOpts2.textDirection !== "horz" ? ` vert="${cellOpts2.textDirection}"` : "";
            let fillColor = ((_d2 = (_c2 = cell._optImp) === null || _c2 === void 0 ? void 0 : _c2.fill) === null || _d2 === void 0 ? void 0 : _d2.color) ? cell._optImp.fill.color : ((_e2 = cell._optImp) === null || _e2 === void 0 ? void 0 : _e2.fill) && typeof cell._optImp.fill === "string" ? cell._optImp.fill : "";
            fillColor = fillColor || cellOpts2.fill ? cellOpts2.fill : "";
            const cellFill = fillColor ? genXmlColorSelection(fillColor) : "";
            let cellMargin = cellOpts2.margin === 0 || cellOpts2.margin ? cellOpts2.margin : DEF_CELL_MARGIN_IN;
            if (!Array.isArray(cellMargin) && typeof cellMargin === "number")
              cellMargin = [cellMargin, cellMargin, cellMargin, cellMargin];
            let cellMarginXml = "";
            if (cellMargin[0] >= 1) {
              cellMarginXml = ` marL="${valToPts(cellMargin[3])}" marR="${valToPts(cellMargin[1])}" marT="${valToPts(cellMargin[0])}" marB="${valToPts(cellMargin[2])}"`;
            } else {
              cellMarginXml = ` marL="${inch2Emu(cellMargin[3])}" marR="${inch2Emu(cellMargin[1])}" marT="${inch2Emu(cellMargin[0])}" marB="${inch2Emu(cellMargin[2])}"`;
            }
            strXml += `<a:tc${cellSpanAttrStr}>${genXmlTextBody(cell)}<a:tcPr${cellMarginXml}${cellValign}${cellTextDir}>`;
            if (cellOpts2.border && Array.isArray(cellOpts2.border)) {
              [
                { idx: 3, name: "lnL" },
                { idx: 1, name: "lnR" },
                { idx: 0, name: "lnT" },
                { idx: 2, name: "lnB" }
              ].forEach((obj) => {
                if (cellOpts2.border[obj.idx].type !== "none") {
                  strXml += `<a:${obj.name} w="${valToPts(cellOpts2.border[obj.idx].pt)}" cap="flat" cmpd="sng" algn="ctr">`;
                  strXml += `<a:solidFill>${createColorElement(cellOpts2.border[obj.idx].color)}</a:solidFill>`;
                  strXml += `<a:prstDash val="${cellOpts2.border[obj.idx].type === "dash" ? "sysDash" : "solid"}"/><a:round/><a:headEnd type="none" w="med" len="med"/><a:tailEnd type="none" w="med" len="med"/>`;
                  strXml += `</a:${obj.name}>`;
                } else {
                  strXml += `<a:${obj.name} w="0" cap="flat" cmpd="sng" algn="ctr"><a:noFill/></a:${obj.name}>`;
                }
              });
            }
            strXml += cellFill;
            strXml += "  </a:tcPr>";
            strXml += " </a:tc>";
          });
          strXml += "</a:tr>";
        });
        strXml += "      </a:tbl>";
        strXml += "    </a:graphicData>";
        strXml += "  </a:graphic>";
        strXml += "</p:graphicFrame>";
        strSlideXml += strXml;
        intTableNum++;
        break;
      case SLIDE_OBJECT_TYPES.text:
      case SLIDE_OBJECT_TYPES.placeholder:
        if (!slideItemObj.options.line && cy === 0)
          cy = EMU * 0.3;
        if (!slideItemObj.options._bodyProp)
          slideItemObj.options._bodyProp = {};
        if (slideItemObj.options.margin && Array.isArray(slideItemObj.options.margin)) {
          slideItemObj.options._bodyProp.lIns = valToPts(slideItemObj.options.margin[0] || 0);
          slideItemObj.options._bodyProp.rIns = valToPts(slideItemObj.options.margin[1] || 0);
          slideItemObj.options._bodyProp.bIns = valToPts(slideItemObj.options.margin[2] || 0);
          slideItemObj.options._bodyProp.tIns = valToPts(slideItemObj.options.margin[3] || 0);
        } else if (typeof slideItemObj.options.margin === "number") {
          slideItemObj.options._bodyProp.lIns = valToPts(slideItemObj.options.margin);
          slideItemObj.options._bodyProp.rIns = valToPts(slideItemObj.options.margin);
          slideItemObj.options._bodyProp.bIns = valToPts(slideItemObj.options.margin);
          slideItemObj.options._bodyProp.tIns = valToPts(slideItemObj.options.margin);
        }
        strSlideXml += "<p:sp>";
        strSlideXml += `<p:nvSpPr><p:cNvPr id="${idx + 2}" name="${slideItemObj.options.objectName}">`;
        if ((_c = slideItemObj.options.hyperlink) === null || _c === void 0 ? void 0 : _c.url) {
          strSlideXml += `<a:hlinkClick r:id="rId${slideItemObj.options.hyperlink._rId}" tooltip="${slideItemObj.options.hyperlink.tooltip ? encodeXmlEntities(slideItemObj.options.hyperlink.tooltip) : ""}"/>`;
        }
        if ((_d = slideItemObj.options.hyperlink) === null || _d === void 0 ? void 0 : _d.slide) {
          strSlideXml += `<a:hlinkClick r:id="rId${slideItemObj.options.hyperlink._rId}" tooltip="${slideItemObj.options.hyperlink.tooltip ? encodeXmlEntities(slideItemObj.options.hyperlink.tooltip) : ""}" action="ppaction://hlinksldjump"/>`;
        }
        strSlideXml += "</p:cNvPr>";
        strSlideXml += "<p:cNvSpPr" + (((_e = slideItemObj.options) === null || _e === void 0 ? void 0 : _e.isTextBox) ? ' txBox="1"/>' : "/>");
        strSlideXml += `<p:nvPr>${slideItemObj._type === "placeholder" ? genXmlPlaceholder(slideItemObj) : genXmlPlaceholder(placeholderObj)}</p:nvPr>`;
        strSlideXml += "</p:nvSpPr><p:spPr>";
        strSlideXml += `<a:xfrm${locationAttr}>`;
        strSlideXml += `<a:off x="${x}" y="${y}"/>`;
        strSlideXml += `<a:ext cx="${cx}" cy="${cy}"/></a:xfrm>`;
        if (slideItemObj.shape === "custGeom") {
          strSlideXml += "<a:custGeom><a:avLst />";
          strSlideXml += "<a:gdLst>";
          strSlideXml += "</a:gdLst>";
          strSlideXml += "<a:ahLst />";
          strSlideXml += "<a:cxnLst>";
          strSlideXml += "</a:cxnLst>";
          strSlideXml += '<a:rect l="l" t="t" r="r" b="b" />';
          strSlideXml += "<a:pathLst>";
          strSlideXml += `<a:path w="${cx}" h="${cy}">`;
          (_f = slideItemObj.options.points) === null || _f === void 0 ? void 0 : _f.forEach((point, i) => {
            if ("curve" in point) {
              switch (point.curve.type) {
                case "arc":
                  strSlideXml += `<a:arcTo hR="${getSmartParseNumber(point.curve.hR, "Y", slide._presLayout)}" wR="${getSmartParseNumber(point.curve.wR, "X", slide._presLayout)}" stAng="${convertRotationDegrees(point.curve.stAng)}" swAng="${convertRotationDegrees(point.curve.swAng)}" />`;
                  break;
                case "cubic":
                  strSlideXml += `<a:cubicBezTo>
									<a:pt x="${getSmartParseNumber(point.curve.x1, "X", slide._presLayout)}" y="${getSmartParseNumber(point.curve.y1, "Y", slide._presLayout)}" />
									<a:pt x="${getSmartParseNumber(point.curve.x2, "X", slide._presLayout)}" y="${getSmartParseNumber(point.curve.y2, "Y", slide._presLayout)}" />
									<a:pt x="${getSmartParseNumber(point.x, "X", slide._presLayout)}" y="${getSmartParseNumber(point.y, "Y", slide._presLayout)}" />
									</a:cubicBezTo>`;
                  break;
                case "quadratic":
                  strSlideXml += `<a:quadBezTo>
									<a:pt x="${getSmartParseNumber(point.curve.x1, "X", slide._presLayout)}" y="${getSmartParseNumber(point.curve.y1, "Y", slide._presLayout)}" />
									<a:pt x="${getSmartParseNumber(point.x, "X", slide._presLayout)}" y="${getSmartParseNumber(point.y, "Y", slide._presLayout)}" />
									</a:quadBezTo>`;
                  break;
              }
            } else if ("close" in point) {
              strSlideXml += "<a:close />";
            } else if (point.moveTo || i === 0) {
              strSlideXml += `<a:moveTo><a:pt x="${getSmartParseNumber(point.x, "X", slide._presLayout)}" y="${getSmartParseNumber(point.y, "Y", slide._presLayout)}" /></a:moveTo>`;
            } else {
              strSlideXml += `<a:lnTo><a:pt x="${getSmartParseNumber(point.x, "X", slide._presLayout)}" y="${getSmartParseNumber(point.y, "Y", slide._presLayout)}" /></a:lnTo>`;
            }
          });
          strSlideXml += "</a:path>";
          strSlideXml += "</a:pathLst>";
          strSlideXml += "</a:custGeom>";
        } else {
          strSlideXml += '<a:prstGeom prst="' + slideItemObj.shape + '"><a:avLst>';
          if (slideItemObj.options.rectRadius) {
            strSlideXml += `<a:gd name="adj" fmla="val ${Math.round(slideItemObj.options.rectRadius * EMU * 1e5 / Math.min(cx, cy))}"/>`;
          } else if (slideItemObj.options.angleRange) {
            for (let i = 0; i < 2; i++) {
              const angle = slideItemObj.options.angleRange[i];
              strSlideXml += `<a:gd name="adj${i + 1}" fmla="val ${convertRotationDegrees(angle)}" />`;
            }
            if (slideItemObj.options.arcThicknessRatio) {
              strSlideXml += `<a:gd name="adj3" fmla="val ${Math.round(slideItemObj.options.arcThicknessRatio * 5e4)}" />`;
            }
          }
          strSlideXml += "</a:avLst></a:prstGeom>";
        }
        strSlideXml += slideItemObj.options.fill ? genXmlColorSelection(slideItemObj.options.fill) : "<a:noFill/>";
        if (slideItemObj.options.line) {
          strSlideXml += slideItemObj.options.line.width ? `<a:ln w="${valToPts(slideItemObj.options.line.width)}">` : "<a:ln>";
          if (slideItemObj.options.line.color)
            strSlideXml += genXmlColorSelection(slideItemObj.options.line);
          if (slideItemObj.options.line.dashType)
            strSlideXml += `<a:prstDash val="${slideItemObj.options.line.dashType}"/>`;
          if (slideItemObj.options.line.beginArrowType)
            strSlideXml += `<a:headEnd type="${slideItemObj.options.line.beginArrowType}"/>`;
          if (slideItemObj.options.line.endArrowType)
            strSlideXml += `<a:tailEnd type="${slideItemObj.options.line.endArrowType}"/>`;
          strSlideXml += "</a:ln>";
        }
        if (slideItemObj.options.shadow && slideItemObj.options.shadow.type !== "none") {
          slideItemObj.options.shadow.type = slideItemObj.options.shadow.type || "outer";
          slideItemObj.options.shadow.blur = valToPts(slideItemObj.options.shadow.blur || 8);
          slideItemObj.options.shadow.offset = valToPts(slideItemObj.options.shadow.offset || 4);
          slideItemObj.options.shadow.angle = Math.round((slideItemObj.options.shadow.angle || 270) * 6e4);
          slideItemObj.options.shadow.opacity = Math.round((slideItemObj.options.shadow.opacity || 0.75) * 1e5);
          slideItemObj.options.shadow.color = slideItemObj.options.shadow.color || DEF_TEXT_SHADOW.color;
          strSlideXml += "<a:effectLst>";
          strSlideXml += ` <a:${slideItemObj.options.shadow.type}Shdw ${slideItemObj.options.shadow.type === "outer" ? 'sx="100000" sy="100000" kx="0" ky="0" algn="bl" rotWithShape="0"' : ""} blurRad="${slideItemObj.options.shadow.blur}" dist="${slideItemObj.options.shadow.offset}" dir="${slideItemObj.options.shadow.angle}">`;
          strSlideXml += ` <a:srgbClr val="${slideItemObj.options.shadow.color}">`;
          strSlideXml += ` <a:alpha val="${slideItemObj.options.shadow.opacity}"/></a:srgbClr>`;
          strSlideXml += " </a:outerShdw>";
          strSlideXml += "</a:effectLst>";
        }
        strSlideXml += "</p:spPr>";
        strSlideXml += genXmlTextBody(slideItemObj);
        strSlideXml += "</p:sp>";
        break;
      case SLIDE_OBJECT_TYPES.image:
        strSlideXml += "<p:pic>";
        strSlideXml += "  <p:nvPicPr>";
        strSlideXml += `<p:cNvPr id="${idx + 2}" name="${slideItemObj.options.objectName}" descr="${encodeXmlEntities(slideItemObj.options.altText || slideItemObj.image)}">`;
        if ((_g = slideItemObj.hyperlink) === null || _g === void 0 ? void 0 : _g.url) {
          strSlideXml += `<a:hlinkClick r:id="rId${slideItemObj.hyperlink._rId}" tooltip="${slideItemObj.hyperlink.tooltip ? encodeXmlEntities(slideItemObj.hyperlink.tooltip) : ""}"/>`;
        }
        if ((_h = slideItemObj.hyperlink) === null || _h === void 0 ? void 0 : _h.slide) {
          strSlideXml += `<a:hlinkClick r:id="rId${slideItemObj.hyperlink._rId}" tooltip="${slideItemObj.hyperlink.tooltip ? encodeXmlEntities(slideItemObj.hyperlink.tooltip) : ""}" action="ppaction://hlinksldjump"/>`;
        }
        strSlideXml += "    </p:cNvPr>";
        strSlideXml += '    <p:cNvPicPr><a:picLocks noChangeAspect="1"/></p:cNvPicPr>';
        strSlideXml += "    <p:nvPr>" + genXmlPlaceholder(placeholderObj) + "</p:nvPr>";
        strSlideXml += "  </p:nvPicPr>";
        strSlideXml += "<p:blipFill>";
        if ((slide._relsMedia || []).filter((rel) => rel.rId === slideItemObj.imageRid)[0] && (slide._relsMedia || []).filter((rel) => rel.rId === slideItemObj.imageRid)[0].extn === "svg") {
          strSlideXml += `<a:blip r:embed="rId${slideItemObj.imageRid - 1}">`;
          strSlideXml += slideItemObj.options.transparency ? ` <a:alphaModFix amt="${Math.round((100 - slideItemObj.options.transparency) * 1e3)}"/>` : "";
          strSlideXml += " <a:extLst>";
          strSlideXml += '  <a:ext uri="{96DAC541-7B7A-43D3-8B79-37D633B846F1}">';
          strSlideXml += `   <asvg:svgBlip xmlns:asvg="http://schemas.microsoft.com/office/drawing/2016/SVG/main" r:embed="rId${slideItemObj.imageRid}"/>`;
          strSlideXml += "  </a:ext>";
          strSlideXml += " </a:extLst>";
          strSlideXml += "</a:blip>";
        } else {
          strSlideXml += `<a:blip r:embed="rId${slideItemObj.imageRid}">`;
          strSlideXml += slideItemObj.options.transparency ? `<a:alphaModFix amt="${Math.round((100 - slideItemObj.options.transparency) * 1e3)}"/>` : "";
          strSlideXml += "</a:blip>";
        }
        if (sizing === null || sizing === void 0 ? void 0 : sizing.type) {
          const boxW = sizing.w ? getSmartParseNumber(sizing.w, "X", slide._presLayout) : cx;
          const boxH = sizing.h ? getSmartParseNumber(sizing.h, "Y", slide._presLayout) : cy;
          const boxX = getSmartParseNumber(sizing.x || 0, "X", slide._presLayout);
          const boxY = getSmartParseNumber(sizing.y || 0, "Y", slide._presLayout);
          strSlideXml += ImageSizingXml[sizing.type]({ w: imgWidth, h: imgHeight }, { w: boxW, h: boxH, x: boxX, y: boxY });
          imgWidth = boxW;
          imgHeight = boxH;
        } else {
          strSlideXml += "  <a:stretch><a:fillRect/></a:stretch>";
        }
        strSlideXml += "</p:blipFill>";
        strSlideXml += "<p:spPr>";
        strSlideXml += " <a:xfrm" + locationAttr + ">";
        strSlideXml += `  <a:off x="${x}" y="${y}"/>`;
        strSlideXml += `  <a:ext cx="${imgWidth}" cy="${imgHeight}"/>`;
        strSlideXml += " </a:xfrm>";
        strSlideXml += ` <a:prstGeom prst="${rounding ? "ellipse" : "rect"}"><a:avLst/></a:prstGeom>`;
        if (slideItemObj.options.shadow && slideItemObj.options.shadow.type !== "none") {
          slideItemObj.options.shadow.type = slideItemObj.options.shadow.type || "outer";
          slideItemObj.options.shadow.blur = valToPts(slideItemObj.options.shadow.blur || 8);
          slideItemObj.options.shadow.offset = valToPts(slideItemObj.options.shadow.offset || 4);
          slideItemObj.options.shadow.angle = Math.round((slideItemObj.options.shadow.angle || 270) * 6e4);
          slideItemObj.options.shadow.opacity = Math.round((slideItemObj.options.shadow.opacity || 0.75) * 1e5);
          slideItemObj.options.shadow.color = slideItemObj.options.shadow.color || DEF_TEXT_SHADOW.color;
          strSlideXml += "<a:effectLst>";
          strSlideXml += `<a:${slideItemObj.options.shadow.type}Shdw ${slideItemObj.options.shadow.type === "outer" ? 'sx="100000" sy="100000" kx="0" ky="0" algn="bl" rotWithShape="0"' : ""} blurRad="${slideItemObj.options.shadow.blur}" dist="${slideItemObj.options.shadow.offset}" dir="${slideItemObj.options.shadow.angle}">`;
          strSlideXml += `<a:srgbClr val="${slideItemObj.options.shadow.color}">`;
          strSlideXml += `<a:alpha val="${slideItemObj.options.shadow.opacity}"/></a:srgbClr>`;
          strSlideXml += `</a:${slideItemObj.options.shadow.type}Shdw>`;
          strSlideXml += "</a:effectLst>";
        }
        strSlideXml += "</p:spPr>";
        strSlideXml += "</p:pic>";
        break;
      case SLIDE_OBJECT_TYPES.media:
        if (slideItemObj.mtype === "online") {
          strSlideXml += "<p:pic>";
          strSlideXml += " <p:nvPicPr>";
          strSlideXml += `<p:cNvPr id="${slideItemObj.mediaRid + 2}" name="${slideItemObj.options.objectName}"/>`;
          strSlideXml += " <p:cNvPicPr/>";
          strSlideXml += " <p:nvPr>";
          strSlideXml += `  <a:videoFile r:link="rId${slideItemObj.mediaRid}"/>`;
          strSlideXml += " </p:nvPr>";
          strSlideXml += " </p:nvPicPr>";
          strSlideXml += ` <p:blipFill><a:blip r:embed="rId${slideItemObj.mediaRid + 1}"/><a:stretch><a:fillRect/></a:stretch></p:blipFill>`;
          strSlideXml += " <p:spPr>";
          strSlideXml += `  <a:xfrm${locationAttr}><a:off x="${x}" y="${y}"/><a:ext cx="${cx}" cy="${cy}"/></a:xfrm>`;
          strSlideXml += '  <a:prstGeom prst="rect"><a:avLst/></a:prstGeom>';
          strSlideXml += " </p:spPr>";
          strSlideXml += "</p:pic>";
        } else {
          strSlideXml += "<p:pic>";
          strSlideXml += " <p:nvPicPr>";
          strSlideXml += `<p:cNvPr id="${slideItemObj.mediaRid + 2}" name="${slideItemObj.options.objectName}"><a:hlinkClick r:id="" action="ppaction://media"/></p:cNvPr>`;
          strSlideXml += ' <p:cNvPicPr><a:picLocks noChangeAspect="1"/></p:cNvPicPr>';
          strSlideXml += " <p:nvPr>";
          strSlideXml += `  <a:videoFile r:link="rId${slideItemObj.mediaRid}"/>`;
          strSlideXml += "  <p:extLst>";
          strSlideXml += '   <p:ext uri="{DAA4B4D4-6D71-4841-9C94-3DE7FCFB9230}">';
          strSlideXml += `    <p14:media xmlns:p14="http://schemas.microsoft.com/office/powerpoint/2010/main" r:embed="rId${slideItemObj.mediaRid + 1}"/>`;
          strSlideXml += "   </p:ext>";
          strSlideXml += "  </p:extLst>";
          strSlideXml += " </p:nvPr>";
          strSlideXml += " </p:nvPicPr>";
          strSlideXml += ` <p:blipFill><a:blip r:embed="rId${slideItemObj.mediaRid + 2}"/><a:stretch><a:fillRect/></a:stretch></p:blipFill>`;
          strSlideXml += " <p:spPr>";
          strSlideXml += `  <a:xfrm${locationAttr}><a:off x="${x}" y="${y}"/><a:ext cx="${cx}" cy="${cy}"/></a:xfrm>`;
          strSlideXml += '  <a:prstGeom prst="rect"><a:avLst/></a:prstGeom>';
          strSlideXml += " </p:spPr>";
          strSlideXml += "</p:pic>";
        }
        break;
      case SLIDE_OBJECT_TYPES.chart:
        strSlideXml += "<p:graphicFrame>";
        strSlideXml += " <p:nvGraphicFramePr>";
        strSlideXml += `   <p:cNvPr id="${idx + 2}" name="${slideItemObj.options.objectName}" descr="${encodeXmlEntities(slideItemObj.options.altText || "")}"/>`;
        strSlideXml += "   <p:cNvGraphicFramePr/>";
        strSlideXml += `   <p:nvPr>${genXmlPlaceholder(placeholderObj)}</p:nvPr>`;
        strSlideXml += " </p:nvGraphicFramePr>";
        strSlideXml += ` <p:xfrm><a:off x="${x}" y="${y}"/><a:ext cx="${cx}" cy="${cy}"/></p:xfrm>`;
        strSlideXml += ' <a:graphic xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main">';
        strSlideXml += '  <a:graphicData uri="http://schemas.openxmlformats.org/drawingml/2006/chart">';
        strSlideXml += `   <c:chart r:id="rId${slideItemObj.chartRid}" xmlns:c="http://schemas.openxmlformats.org/drawingml/2006/chart"/>`;
        strSlideXml += "  </a:graphicData>";
        strSlideXml += " </a:graphic>";
        strSlideXml += "</p:graphicFrame>";
        break;
      default:
        strSlideXml += "";
        break;
    }
  });
  if (slide._slideNumberProps) {
    if (!slide._slideNumberProps.align)
      slide._slideNumberProps.align = "left";
    strSlideXml += "<p:sp>";
    strSlideXml += " <p:nvSpPr>";
    strSlideXml += '  <p:cNvPr id="25" name="Slide Number Placeholder 0"/><p:cNvSpPr><a:spLocks noGrp="1"/></p:cNvSpPr>';
    strSlideXml += '  <p:nvPr><p:ph type="sldNum" sz="quarter" idx="4294967295"/></p:nvPr>';
    strSlideXml += " </p:nvSpPr>";
    strSlideXml += " <p:spPr>";
    strSlideXml += `<a:xfrm><a:off x="${getSmartParseNumber(slide._slideNumberProps.x, "X", slide._presLayout)}" y="${getSmartParseNumber(slide._slideNumberProps.y, "Y", slide._presLayout)}"/><a:ext cx="${slide._slideNumberProps.w ? getSmartParseNumber(slide._slideNumberProps.w, "X", slide._presLayout) : "800000"}" cy="${slide._slideNumberProps.h ? getSmartParseNumber(slide._slideNumberProps.h, "Y", slide._presLayout) : "300000"}"/></a:xfrm> <a:prstGeom prst="rect"><a:avLst/></a:prstGeom> <a:extLst><a:ext uri="{C572A759-6A51-4108-AA02-DFA0A04FC94B}"><ma14:wrappingTextBoxFlag val="0" xmlns:ma14="http://schemas.microsoft.com/office/mac/drawingml/2011/main"/></a:ext></a:extLst></p:spPr>`;
    strSlideXml += "<p:txBody>";
    strSlideXml += "<a:bodyPr";
    if (slide._slideNumberProps.margin && Array.isArray(slide._slideNumberProps.margin)) {
      strSlideXml += ` lIns="${valToPts(slide._slideNumberProps.margin[3] || 0)}"`;
      strSlideXml += ` tIns="${valToPts(slide._slideNumberProps.margin[0] || 0)}"`;
      strSlideXml += ` rIns="${valToPts(slide._slideNumberProps.margin[1] || 0)}"`;
      strSlideXml += ` bIns="${valToPts(slide._slideNumberProps.margin[2] || 0)}"`;
    } else if (typeof slide._slideNumberProps.margin === "number") {
      strSlideXml += ` lIns="${valToPts(slide._slideNumberProps.margin || 0)}"`;
      strSlideXml += ` tIns="${valToPts(slide._slideNumberProps.margin || 0)}"`;
      strSlideXml += ` rIns="${valToPts(slide._slideNumberProps.margin || 0)}"`;
      strSlideXml += ` bIns="${valToPts(slide._slideNumberProps.margin || 0)}"`;
    }
    if (slide._slideNumberProps.valign) {
      strSlideXml += ` anchor="${slide._slideNumberProps.valign.replace("top", "t").replace("middle", "ctr").replace("bottom", "b")}"`;
    }
    strSlideXml += "/>";
    strSlideXml += "  <a:lstStyle><a:lvl1pPr>";
    if (slide._slideNumberProps.fontFace || slide._slideNumberProps.fontSize || slide._slideNumberProps.color) {
      strSlideXml += `<a:defRPr sz="${Math.round((slide._slideNumberProps.fontSize || 12) * 100)}">`;
      if (slide._slideNumberProps.color)
        strSlideXml += genXmlColorSelection(slide._slideNumberProps.color);
      if (slide._slideNumberProps.fontFace) {
        strSlideXml += `<a:latin typeface="${slide._slideNumberProps.fontFace}"/><a:ea typeface="${slide._slideNumberProps.fontFace}"/><a:cs typeface="${slide._slideNumberProps.fontFace}"/>`;
      }
      strSlideXml += "</a:defRPr>";
    }
    strSlideXml += "</a:lvl1pPr></a:lstStyle>";
    strSlideXml += "<a:p>";
    if (slide._slideNumberProps.align.startsWith("l"))
      strSlideXml += '<a:pPr algn="l"/>';
    else if (slide._slideNumberProps.align.startsWith("c"))
      strSlideXml += '<a:pPr algn="ctr"/>';
    else if (slide._slideNumberProps.align.startsWith("r"))
      strSlideXml += '<a:pPr algn="r"/>';
    else
      strSlideXml += '<a:pPr algn="l"/>';
    strSlideXml += `<a:fld id="${SLDNUMFLDID}" type="slidenum"><a:rPr b="${slide._slideNumberProps.bold ? 1 : 0}" lang="en-US"/>`;
    strSlideXml += `<a:t>${slide._slideNum}</a:t></a:fld><a:endParaRPr lang="en-US"/></a:p>`;
    strSlideXml += "</p:txBody></p:sp>";
  }
  strSlideXml += "</p:spTree>";
  strSlideXml += "</p:cSld>";
  return strSlideXml;
}
function slideObjectRelationsToXml(slide, defaultRels) {
  let lastRid = 0;
  let strXml = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' + CRLF + '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">';
  slide._rels.forEach((rel) => {
    lastRid = Math.max(lastRid, rel.rId);
    if (rel.type.toLowerCase().includes("hyperlink")) {
      if (rel.data === "slide") {
        strXml += `<Relationship Id="rId${rel.rId}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/slide" Target="slide${rel.Target}.xml"/>`;
      } else {
        strXml += `<Relationship Id="rId${rel.rId}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/hyperlink" Target="${rel.Target}" TargetMode="External"/>`;
      }
    } else if (rel.type.toLowerCase().includes("notesSlide")) {
      strXml += `<Relationship Id="rId${rel.rId}" Target="${rel.Target}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/notesSlide"/>`;
    }
  });
  (slide._relsChart || []).forEach((rel) => {
    lastRid = Math.max(lastRid, rel.rId);
    strXml += `<Relationship Id="rId${rel.rId}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/chart" Target="${rel.Target}"/>`;
  });
  (slide._relsMedia || []).forEach((rel) => {
    const relRid = rel.rId.toString();
    lastRid = Math.max(lastRid, rel.rId);
    if (rel.type.toLowerCase().includes("image")) {
      strXml += '<Relationship Id="rId' + relRid + '" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/image" Target="' + rel.Target + '"/>';
    } else if (rel.type.toLowerCase().includes("audio")) {
      if (strXml.includes(' Target="' + rel.Target + '"')) {
        strXml += '<Relationship Id="rId' + relRid + '" Type="http://schemas.microsoft.com/office/2007/relationships/media" Target="' + rel.Target + '"/>';
      } else {
        strXml += '<Relationship Id="rId' + relRid + '" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/audio" Target="' + rel.Target + '"/>';
      }
    } else if (rel.type.toLowerCase().includes("video")) {
      if (strXml.includes(' Target="' + rel.Target + '"')) {
        strXml += '<Relationship Id="rId' + relRid + '" Type="http://schemas.microsoft.com/office/2007/relationships/media" Target="' + rel.Target + '"/>';
      } else {
        strXml += '<Relationship Id="rId' + relRid + '" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/video" Target="' + rel.Target + '"/>';
      }
    } else if (rel.type.toLowerCase().includes("online")) {
      if (strXml.includes(' Target="' + rel.Target + '"')) {
        strXml += '<Relationship Id="rId' + relRid + '" Type="http://schemas.microsoft.com/office/2007/relationships/image" Target="' + rel.Target + '"/>';
      } else {
        strXml += '<Relationship Id="rId' + relRid + '" Target="' + rel.Target + '" TargetMode="External" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/video"/>';
      }
    }
  });
  defaultRels.forEach((rel, idx) => {
    strXml += `<Relationship Id="rId${lastRid + idx + 1}" Type="${rel.type}" Target="${rel.target}"/>`;
  });
  strXml += "</Relationships>";
  return strXml;
}
function genXmlParagraphProperties(textObj, isDefault) {
  var _a, _b;
  let strXmlBullet = "";
  let strXmlLnSpc = "";
  let strXmlParaSpc = "";
  let strXmlTabStops = "";
  const tag = isDefault ? "a:lvl1pPr" : "a:pPr";
  let bulletMarL = valToPts(DEF_BULLET_MARGIN);
  let paragraphPropXml = `<${tag}${textObj.options.rtlMode ? ' rtl="1" ' : ""}`;
  {
    if (textObj.options.align) {
      switch (textObj.options.align) {
        case "left":
          paragraphPropXml += ' algn="l"';
          break;
        case "right":
          paragraphPropXml += ' algn="r"';
          break;
        case "center":
          paragraphPropXml += ' algn="ctr"';
          break;
        case "justify":
          paragraphPropXml += ' algn="just"';
          break;
        default:
          paragraphPropXml += "";
          break;
      }
    }
    if (textObj.options.lineSpacing) {
      strXmlLnSpc = `<a:lnSpc><a:spcPts val="${Math.round(textObj.options.lineSpacing * 100)}"/></a:lnSpc>`;
    } else if (textObj.options.lineSpacingMultiple) {
      strXmlLnSpc = `<a:lnSpc><a:spcPct val="${Math.round(textObj.options.lineSpacingMultiple * 1e5)}"/></a:lnSpc>`;
    }
    if (textObj.options.indentLevel && !isNaN(Number(textObj.options.indentLevel)) && textObj.options.indentLevel > 0) {
      paragraphPropXml += ` lvl="${textObj.options.indentLevel}"`;
    }
    if (textObj.options.paraSpaceBefore && !isNaN(Number(textObj.options.paraSpaceBefore)) && textObj.options.paraSpaceBefore > 0) {
      strXmlParaSpc += `<a:spcBef><a:spcPts val="${Math.round(textObj.options.paraSpaceBefore * 100)}"/></a:spcBef>`;
    }
    if (textObj.options.paraSpaceAfter && !isNaN(Number(textObj.options.paraSpaceAfter)) && textObj.options.paraSpaceAfter > 0) {
      strXmlParaSpc += `<a:spcAft><a:spcPts val="${Math.round(textObj.options.paraSpaceAfter * 100)}"/></a:spcAft>`;
    }
    if (typeof textObj.options.bullet === "object") {
      if ((_b = (_a = textObj === null || textObj === void 0 ? void 0 : textObj.options) === null || _a === void 0 ? void 0 : _a.bullet) === null || _b === void 0 ? void 0 : _b.indent)
        bulletMarL = valToPts(textObj.options.bullet.indent);
      if (textObj.options.bullet.type) {
        if (textObj.options.bullet.type.toString().toLowerCase() === "number") {
          paragraphPropXml += ` marL="${textObj.options.indentLevel && textObj.options.indentLevel > 0 ? bulletMarL + bulletMarL * textObj.options.indentLevel : bulletMarL}" indent="-${bulletMarL}"`;
          strXmlBullet = `<a:buSzPct val="100000"/><a:buFont typeface="+mj-lt"/><a:buAutoNum type="${textObj.options.bullet.style || "arabicPeriod"}" startAt="${textObj.options.bullet.numberStartAt || textObj.options.bullet.startAt || "1"}"/>`;
        }
      } else if (textObj.options.bullet.characterCode) {
        let bulletCode = `&#x${textObj.options.bullet.characterCode};`;
        if (!/^[0-9A-Fa-f]{4}$/.test(textObj.options.bullet.characterCode)) {
          console.warn("Warning: `bullet.characterCode should be a 4-digit unicode charatcer (ex: 22AB)`!");
          bulletCode = BULLET_TYPES.DEFAULT;
        }
        paragraphPropXml += ` marL="${textObj.options.indentLevel && textObj.options.indentLevel > 0 ? bulletMarL + bulletMarL * textObj.options.indentLevel : bulletMarL}" indent="-${bulletMarL}"`;
        strXmlBullet = '<a:buSzPct val="100000"/><a:buChar char="' + bulletCode + '"/>';
      } else if (textObj.options.bullet.code) {
        let bulletCode = `&#x${textObj.options.bullet.code};`;
        if (!/^[0-9A-Fa-f]{4}$/.test(textObj.options.bullet.code)) {
          console.warn("Warning: `bullet.code should be a 4-digit hex code (ex: 22AB)`!");
          bulletCode = BULLET_TYPES.DEFAULT;
        }
        paragraphPropXml += ` marL="${textObj.options.indentLevel && textObj.options.indentLevel > 0 ? bulletMarL + bulletMarL * textObj.options.indentLevel : bulletMarL}" indent="-${bulletMarL}"`;
        strXmlBullet = '<a:buSzPct val="100000"/><a:buChar char="' + bulletCode + '"/>';
      } else {
        paragraphPropXml += ` marL="${textObj.options.indentLevel && textObj.options.indentLevel > 0 ? bulletMarL + bulletMarL * textObj.options.indentLevel : bulletMarL}" indent="-${bulletMarL}"`;
        strXmlBullet = `<a:buSzPct val="100000"/><a:buChar char="${BULLET_TYPES.DEFAULT}"/>`;
      }
    } else if (textObj.options.bullet) {
      paragraphPropXml += ` marL="${textObj.options.indentLevel && textObj.options.indentLevel > 0 ? bulletMarL + bulletMarL * textObj.options.indentLevel : bulletMarL}" indent="-${bulletMarL}"`;
      strXmlBullet = `<a:buSzPct val="100000"/><a:buChar char="${BULLET_TYPES.DEFAULT}"/>`;
    } else if (!textObj.options.bullet) {
      paragraphPropXml += ' indent="0" marL="0"';
      strXmlBullet = "<a:buNone/>";
    }
    if (textObj.options.tabStops && Array.isArray(textObj.options.tabStops)) {
      const tabStopsXml = textObj.options.tabStops.map((stop) => `<a:tab pos="${inch2Emu(stop.position || 1)}" algn="${stop.alignment || "l"}"/>`).join("");
      strXmlTabStops = `<a:tabLst>${tabStopsXml}</a:tabLst>`;
    }
    paragraphPropXml += ">" + strXmlLnSpc + strXmlParaSpc + strXmlBullet + strXmlTabStops;
    if (isDefault)
      paragraphPropXml += genXmlTextRunProperties(textObj.options, true);
    paragraphPropXml += "</" + tag + ">";
  }
  return paragraphPropXml;
}
function genXmlTextRunProperties(opts, isDefault) {
  var _a;
  let runProps = "";
  const runPropsTag = isDefault ? "a:defRPr" : "a:rPr";
  runProps += "<" + runPropsTag + ' lang="' + (opts.lang ? opts.lang : "en-US") + '"' + (opts.lang ? ' altLang="en-US"' : "");
  runProps += opts.fontSize ? ` sz="${Math.round(opts.fontSize * 100)}"` : "";
  runProps += (opts === null || opts === void 0 ? void 0 : opts.bold) ? ` b="${opts.bold ? "1" : "0"}"` : "";
  runProps += (opts === null || opts === void 0 ? void 0 : opts.italic) ? ` i="${opts.italic ? "1" : "0"}"` : "";
  runProps += (opts === null || opts === void 0 ? void 0 : opts.strike) ? ` strike="${typeof opts.strike === "string" ? opts.strike : "sngStrike"}"` : "";
  if (typeof opts.underline === "object" && ((_a = opts.underline) === null || _a === void 0 ? void 0 : _a.style)) {
    runProps += ` u="${opts.underline.style}"`;
  } else if (typeof opts.underline === "string") {
    runProps += ` u="${String(opts.underline)}"`;
  } else if (opts.hyperlink) {
    runProps += ' u="sng"';
  }
  if (opts.baseline) {
    runProps += ` baseline="${Math.round(opts.baseline * 50)}"`;
  } else if (opts.subscript) {
    runProps += ' baseline="-40000"';
  } else if (opts.superscript) {
    runProps += ' baseline="30000"';
  }
  runProps += opts.charSpacing ? ` spc="${Math.round(opts.charSpacing * 100)}" kern="0"` : "";
  runProps += ' dirty="0">';
  if (opts.color || opts.fontFace || opts.outline || typeof opts.underline === "object" && opts.underline.color) {
    if (opts.outline && typeof opts.outline === "object") {
      runProps += `<a:ln w="${valToPts(opts.outline.size || 0.75)}">${genXmlColorSelection(opts.outline.color || "FFFFFF")}</a:ln>`;
    }
    if (opts.color)
      runProps += genXmlColorSelection({ color: opts.color, transparency: opts.transparency });
    if (opts.highlight)
      runProps += `<a:highlight>${createColorElement(opts.highlight)}</a:highlight>`;
    if (typeof opts.underline === "object" && opts.underline.color)
      runProps += `<a:uFill>${genXmlColorSelection(opts.underline.color)}</a:uFill>`;
    if (opts.glow)
      runProps += `<a:effectLst>${createGlowElement(opts.glow, DEF_TEXT_GLOW)}</a:effectLst>`;
    if (opts.fontFace) {
      runProps += `<a:latin typeface="${opts.fontFace}" pitchFamily="34" charset="0"/><a:ea typeface="${opts.fontFace}" pitchFamily="34" charset="-122"/><a:cs typeface="${opts.fontFace}" pitchFamily="34" charset="-120"/>`;
    }
  }
  if (opts.hyperlink) {
    if (typeof opts.hyperlink !== "object")
      throw new Error("ERROR: text `hyperlink` option should be an object. Ex: `hyperlink:{url:'https://github.com'}` ");
    else if (!opts.hyperlink.url && !opts.hyperlink.slide)
      throw new Error("ERROR: 'hyperlink requires either `url` or `slide`'");
    else if (opts.hyperlink.url) {
      runProps += `<a:hlinkClick r:id="rId${opts.hyperlink._rId}" invalidUrl="" action="" tgtFrame="" tooltip="${opts.hyperlink.tooltip ? encodeXmlEntities(opts.hyperlink.tooltip) : ""}" history="1" highlightClick="0" endSnd="0"${opts.color ? ">" : "/>"}`;
    } else if (opts.hyperlink.slide) {
      runProps += `<a:hlinkClick r:id="rId${opts.hyperlink._rId}" action="ppaction://hlinksldjump" tooltip="${opts.hyperlink.tooltip ? encodeXmlEntities(opts.hyperlink.tooltip) : ""}"${opts.color ? ">" : "/>"}`;
    }
    if (opts.color) {
      runProps += " <a:extLst>";
      runProps += '  <a:ext uri="{A12FA001-AC4F-418D-AE19-62706E023703}">';
      runProps += '   <ahyp:hlinkClr xmlns:ahyp="http://schemas.microsoft.com/office/drawing/2018/hyperlinkcolor" val="tx"/>';
      runProps += "  </a:ext>";
      runProps += " </a:extLst>";
      runProps += "</a:hlinkClick>";
    }
  }
  runProps += `</${runPropsTag}>`;
  return runProps;
}
function genXmlTextRun(textObj) {
  return textObj.text ? `<a:r>${genXmlTextRunProperties(textObj.options, false)}<a:t>${encodeXmlEntities(textObj.text)}</a:t></a:r>` : "";
}
function genXmlBodyProperties(slideObject) {
  let bodyProperties = "<a:bodyPr";
  if (slideObject && slideObject._type === SLIDE_OBJECT_TYPES.text && slideObject.options._bodyProp) {
    bodyProperties += slideObject.options._bodyProp.wrap ? ' wrap="square"' : ' wrap="none"';
    if (slideObject.options._bodyProp.lIns || slideObject.options._bodyProp.lIns === 0)
      bodyProperties += ` lIns="${slideObject.options._bodyProp.lIns}"`;
    if (slideObject.options._bodyProp.tIns || slideObject.options._bodyProp.tIns === 0)
      bodyProperties += ` tIns="${slideObject.options._bodyProp.tIns}"`;
    if (slideObject.options._bodyProp.rIns || slideObject.options._bodyProp.rIns === 0)
      bodyProperties += ` rIns="${slideObject.options._bodyProp.rIns}"`;
    if (slideObject.options._bodyProp.bIns || slideObject.options._bodyProp.bIns === 0)
      bodyProperties += ` bIns="${slideObject.options._bodyProp.bIns}"`;
    bodyProperties += ' rtlCol="0"';
    if (slideObject.options._bodyProp.anchor)
      bodyProperties += ' anchor="' + slideObject.options._bodyProp.anchor + '"';
    if (slideObject.options._bodyProp.vert)
      bodyProperties += ' vert="' + slideObject.options._bodyProp.vert + '"';
    bodyProperties += ">";
    if (slideObject.options.fit) {
      if (slideObject.options.fit === "none")
        bodyProperties += "";
      else if (slideObject.options.fit === "shrink")
        bodyProperties += "<a:normAutofit/>";
      else if (slideObject.options.fit === "resize")
        bodyProperties += "<a:spAutoFit/>";
    }
    if (slideObject.options.shrinkText)
      bodyProperties += "<a:normAutofit/>";
    bodyProperties += slideObject.options._bodyProp.autoFit ? "<a:spAutoFit/>" : "";
    bodyProperties += "</a:bodyPr>";
  } else {
    bodyProperties += ' wrap="square" rtlCol="0">';
    bodyProperties += "</a:bodyPr>";
  }
  return slideObject._type === SLIDE_OBJECT_TYPES.tablecell ? "<a:bodyPr/>" : bodyProperties;
}
function genXmlTextBody(slideObj) {
  const opts = slideObj.options || {};
  let tmpTextObjects = [];
  const arrTextObjects = [];
  if (opts && slideObj._type !== SLIDE_OBJECT_TYPES.tablecell && (typeof slideObj.text === "undefined" || slideObj.text === null))
    return "";
  let strSlideXml = slideObj._type === SLIDE_OBJECT_TYPES.tablecell ? "<a:txBody>" : "<p:txBody>";
  {
    strSlideXml += genXmlBodyProperties(slideObj);
    if (opts.h === 0 && opts.line && opts.align)
      strSlideXml += '<a:lstStyle><a:lvl1pPr algn="l"/></a:lstStyle>';
    else if (slideObj._type === "placeholder")
      strSlideXml += `<a:lstStyle>${genXmlParagraphProperties(slideObj, true)}</a:lstStyle>`;
    else
      strSlideXml += "<a:lstStyle/>";
  }
  if (typeof slideObj.text === "string" || typeof slideObj.text === "number") {
    tmpTextObjects.push({ text: slideObj.text.toString(), options: opts || {} });
  } else if (slideObj.text && !Array.isArray(slideObj.text) && typeof slideObj.text === "object" && Object.keys(slideObj.text).includes("text")) {
    tmpTextObjects.push({ text: slideObj.text || "", options: slideObj.options || {} });
  } else if (Array.isArray(slideObj.text)) {
    tmpTextObjects = slideObj.text.map((item) => ({ text: item.text, options: item.options }));
  }
  tmpTextObjects.forEach((itext, idx) => {
    if (!itext.text)
      itext.text = "";
    itext.options = itext.options || opts || {};
    if (idx === 0 && itext.options && !itext.options.bullet && opts.bullet)
      itext.options.bullet = opts.bullet;
    if (typeof itext.text === "string" || typeof itext.text === "number") {
      itext.text = itext.text.toString().replace(/\r*\n/g, CRLF);
    }
    if (itext.text.includes(CRLF) && itext.text.match(/\n$/g) === null) {
      itext.text.split(CRLF).forEach((line) => {
        itext.options.breakLine = true;
        arrTextObjects.push({ text: line, options: itext.options });
      });
    } else {
      arrTextObjects.push(itext);
    }
  });
  const arrLines = [];
  let arrTexts = [];
  arrTextObjects.forEach((textObj, idx) => {
    if (arrTexts.length > 0 && (textObj.options.align || opts.align)) {
      if (textObj.options.align !== arrTextObjects[idx - 1].options.align) {
        arrLines.push(arrTexts);
        arrTexts = [];
      }
    } else if (arrTexts.length > 0 && textObj.options.bullet && arrTexts.length > 0) {
      arrLines.push(arrTexts);
      arrTexts = [];
      textObj.options.breakLine = false;
    }
    arrTexts.push(textObj);
    if (arrTexts.length > 0 && textObj.options.breakLine) {
      if (idx + 1 < arrTextObjects.length) {
        arrLines.push(arrTexts);
        arrTexts = [];
      }
    }
    if (idx + 1 === arrTextObjects.length)
      arrLines.push(arrTexts);
  });
  arrLines.forEach((line) => {
    var _a;
    let reqsClosingFontSize = false;
    strSlideXml += "<a:p>";
    let paragraphPropXml = `<a:pPr ${((_a = line[0].options) === null || _a === void 0 ? void 0 : _a.rtlMode) ? ' rtl="1" ' : ""}`;
    line.forEach((textObj, idx) => {
      textObj.options._lineIdx = idx;
      if (idx > 0 && textObj.options.softBreakBefore) {
        strSlideXml += "<a:br/>";
      }
      textObj.options.align = textObj.options.align || opts.align;
      textObj.options.lineSpacing = textObj.options.lineSpacing || opts.lineSpacing;
      textObj.options.lineSpacingMultiple = textObj.options.lineSpacingMultiple || opts.lineSpacingMultiple;
      textObj.options.indentLevel = textObj.options.indentLevel || opts.indentLevel;
      textObj.options.paraSpaceBefore = textObj.options.paraSpaceBefore || opts.paraSpaceBefore;
      textObj.options.paraSpaceAfter = textObj.options.paraSpaceAfter || opts.paraSpaceAfter;
      paragraphPropXml = genXmlParagraphProperties(textObj, false);
      strSlideXml += paragraphPropXml.replace("<a:pPr></a:pPr>", "");
      Object.entries(opts).filter(([key]) => !(textObj.options.hyperlink && key === "color")).forEach(([key, val]) => {
        if (key !== "bullet" && !textObj.options[key])
          textObj.options[key] = val;
      });
      strSlideXml += genXmlTextRun(textObj);
      if (!textObj.text && opts.fontSize || textObj.options.fontSize) {
        reqsClosingFontSize = true;
        opts.fontSize = opts.fontSize || textObj.options.fontSize;
      }
    });
    if (slideObj._type === SLIDE_OBJECT_TYPES.tablecell && (opts.fontSize || opts.fontFace)) {
      if (opts.fontFace) {
        strSlideXml += `<a:endParaRPr lang="${opts.lang || "en-US"}"` + (opts.fontSize ? ` sz="${Math.round(opts.fontSize * 100)}"` : "") + ' dirty="0">';
        strSlideXml += `<a:latin typeface="${opts.fontFace}" charset="0"/>`;
        strSlideXml += `<a:ea typeface="${opts.fontFace}" charset="0"/>`;
        strSlideXml += `<a:cs typeface="${opts.fontFace}" charset="0"/>`;
        strSlideXml += "</a:endParaRPr>";
      } else {
        strSlideXml += `<a:endParaRPr lang="${opts.lang || "en-US"}"` + (opts.fontSize ? ` sz="${Math.round(opts.fontSize * 100)}"` : "") + ' dirty="0"/>';
      }
    } else if (reqsClosingFontSize) {
      strSlideXml += `<a:endParaRPr lang="${opts.lang || "en-US"}"` + (opts.fontSize ? ` sz="${Math.round(opts.fontSize * 100)}"` : "") + ' dirty="0"/>';
    } else {
      strSlideXml += `<a:endParaRPr lang="${opts.lang || "en-US"}" dirty="0"/>`;
    }
    strSlideXml += "</a:p>";
  });
  if (strSlideXml.indexOf("<a:p>") === -1) {
    strSlideXml += "<a:p><a:endParaRPr/></a:p>";
  }
  strSlideXml += slideObj._type === SLIDE_OBJECT_TYPES.tablecell ? "</a:txBody>" : "</p:txBody>";
  return strSlideXml;
}
function genXmlPlaceholder(placeholderObj) {
  var _a, _b;
  if (!placeholderObj)
    return "";
  const placeholderIdx = ((_a = placeholderObj.options) === null || _a === void 0 ? void 0 : _a._placeholderIdx) ? placeholderObj.options._placeholderIdx : "";
  const placeholderTyp = ((_b = placeholderObj.options) === null || _b === void 0 ? void 0 : _b._placeholderType) ? placeholderObj.options._placeholderType : "";
  const placeholderType = placeholderTyp && PLACEHOLDER_TYPES[placeholderTyp] ? PLACEHOLDER_TYPES[placeholderTyp].toString() : "";
  return `<p:ph
		${placeholderIdx ? ' idx="' + placeholderIdx.toString() + '"' : ""}
		${placeholderType && PLACEHOLDER_TYPES[placeholderType] ? ` type="${placeholderType}"` : ""}
		${placeholderObj.text && placeholderObj.text.length > 0 ? ' hasCustomPrompt="1"' : ""}
		/>`;
}
function makeXmlContTypes(slides, slideLayouts, masterSlide) {
  let strXml = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' + CRLF;
  strXml += '<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">';
  strXml += '<Default Extension="xml" ContentType="application/xml"/>';
  strXml += '<Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>';
  strXml += '<Default Extension="jpeg" ContentType="image/jpeg"/>';
  strXml += '<Default Extension="jpg" ContentType="image/jpg"/>';
  strXml += '<Default Extension="svg" ContentType="image/svg+xml"/>';
  strXml += '<Default Extension="png" ContentType="image/png"/>';
  strXml += '<Default Extension="gif" ContentType="image/gif"/>';
  strXml += '<Default Extension="m4v" ContentType="video/mp4"/>';
  strXml += '<Default Extension="mp4" ContentType="video/mp4"/>';
  slides.forEach((slide) => {
    (slide._relsMedia || []).forEach((rel) => {
      if (rel.type !== "image" && rel.type !== "online" && rel.type !== "chart" && rel.extn !== "m4v" && !strXml.includes(rel.type)) {
        strXml += '<Default Extension="' + rel.extn + '" ContentType="' + rel.type + '"/>';
      }
    });
  });
  strXml += '<Default Extension="vml" ContentType="application/vnd.openxmlformats-officedocument.vmlDrawing"/>';
  strXml += '<Default Extension="xlsx" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"/>';
  strXml += '<Override PartName="/ppt/presentation.xml" ContentType="application/vnd.openxmlformats-officedocument.presentationml.presentation.main+xml"/>';
  strXml += '<Override PartName="/ppt/notesMasters/notesMaster1.xml" ContentType="application/vnd.openxmlformats-officedocument.presentationml.notesMaster+xml"/>';
  slides.forEach((slide, idx) => {
    strXml += `<Override PartName="/ppt/slideMasters/slideMaster${idx + 1}.xml" ContentType="application/vnd.openxmlformats-officedocument.presentationml.slideMaster+xml"/>`;
    strXml += `<Override PartName="/ppt/slides/slide${idx + 1}.xml" ContentType="application/vnd.openxmlformats-officedocument.presentationml.slide+xml"/>`;
    slide._relsChart.forEach((rel) => {
      strXml += `<Override PartName="${rel.Target}" ContentType="application/vnd.openxmlformats-officedocument.drawingml.chart+xml"/>`;
    });
  });
  strXml += '<Override PartName="/ppt/presProps.xml" ContentType="application/vnd.openxmlformats-officedocument.presentationml.presProps+xml"/>';
  strXml += '<Override PartName="/ppt/viewProps.xml" ContentType="application/vnd.openxmlformats-officedocument.presentationml.viewProps+xml"/>';
  strXml += '<Override PartName="/ppt/theme/theme1.xml" ContentType="application/vnd.openxmlformats-officedocument.theme+xml"/>';
  strXml += '<Override PartName="/ppt/tableStyles.xml" ContentType="application/vnd.openxmlformats-officedocument.presentationml.tableStyles+xml"/>';
  slideLayouts.forEach((layout, idx) => {
    strXml += `<Override PartName="/ppt/slideLayouts/slideLayout${idx + 1}.xml" ContentType="application/vnd.openxmlformats-officedocument.presentationml.slideLayout+xml"/>`;
    (layout._relsChart || []).forEach((rel) => {
      strXml += ' <Override PartName="' + rel.Target + '" ContentType="application/vnd.openxmlformats-officedocument.drawingml.chart+xml"/>';
    });
  });
  slides.forEach((_slide, idx) => {
    strXml += `<Override PartName="/ppt/notesSlides/notesSlide${idx + 1}.xml" ContentType="application/vnd.openxmlformats-officedocument.presentationml.notesSlide+xml"/>`;
  });
  masterSlide._relsChart.forEach((rel) => {
    strXml += ' <Override PartName="' + rel.Target + '" ContentType="application/vnd.openxmlformats-officedocument.drawingml.chart+xml"/>';
  });
  masterSlide._relsMedia.forEach((rel) => {
    if (rel.type !== "image" && rel.type !== "online" && rel.type !== "chart" && rel.extn !== "m4v" && !strXml.includes(rel.type)) {
      strXml += ' <Default Extension="' + rel.extn + '" ContentType="' + rel.type + '"/>';
    }
  });
  strXml += ' <Override PartName="/docProps/core.xml" ContentType="application/vnd.openxmlformats-package.core-properties+xml"/>';
  strXml += ' <Override PartName="/docProps/app.xml" ContentType="application/vnd.openxmlformats-officedocument.extended-properties+xml"/>';
  strXml += "</Types>";
  return strXml;
}
function makeXmlRootRels() {
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>${CRLF}<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
		<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/extended-properties" Target="docProps/app.xml"/>
		<Relationship Id="rId2" Type="http://schemas.openxmlformats.org/package/2006/relationships/metadata/core-properties" Target="docProps/core.xml"/>
		<Relationship Id="rId3" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="ppt/presentation.xml"/>
		</Relationships>`;
}
function makeXmlApp(slides, company) {
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>${CRLF}<Properties xmlns="http://schemas.openxmlformats.org/officeDocument/2006/extended-properties" xmlns:vt="http://schemas.openxmlformats.org/officeDocument/2006/docPropsVTypes">
	<TotalTime>0</TotalTime>
	<Words>0</Words>
	<Application>Microsoft Office PowerPoint</Application>
	<PresentationFormat>On-screen Show (16:9)</PresentationFormat>
	<Paragraphs>0</Paragraphs>
	<Slides>${slides.length}</Slides>
	<Notes>${slides.length}</Notes>
	<HiddenSlides>0</HiddenSlides>
	<MMClips>0</MMClips>
	<ScaleCrop>false</ScaleCrop>
	<HeadingPairs>
		<vt:vector size="6" baseType="variant">
			<vt:variant><vt:lpstr>Fonts Used</vt:lpstr></vt:variant>
			<vt:variant><vt:i4>2</vt:i4></vt:variant>
			<vt:variant><vt:lpstr>Theme</vt:lpstr></vt:variant>
			<vt:variant><vt:i4>1</vt:i4></vt:variant>
			<vt:variant><vt:lpstr>Slide Titles</vt:lpstr></vt:variant>
			<vt:variant><vt:i4>${slides.length}</vt:i4></vt:variant>
		</vt:vector>
	</HeadingPairs>
	<TitlesOfParts>
		<vt:vector size="${slides.length + 1 + 2}" baseType="lpstr">
			<vt:lpstr>Arial</vt:lpstr>
			<vt:lpstr>Calibri</vt:lpstr>
			<vt:lpstr>Office Theme</vt:lpstr>
			${slides.map((_slideObj, idx) => `<vt:lpstr>Slide ${idx + 1}</vt:lpstr>`).join("")}
		</vt:vector>
	</TitlesOfParts>
	<Company>${company}</Company>
	<LinksUpToDate>false</LinksUpToDate>
	<SharedDoc>false</SharedDoc>
	<HyperlinksChanged>false</HyperlinksChanged>
	<AppVersion>16.0000</AppVersion>
	</Properties>`;
}
function makeXmlCore(title, subject, author, revision) {
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
	<cp:coreProperties xmlns:cp="http://schemas.openxmlformats.org/package/2006/metadata/core-properties" xmlns:dc="http://purl.org/dc/elements/1.1/" xmlns:dcterms="http://purl.org/dc/terms/" xmlns:dcmitype="http://purl.org/dc/dcmitype/" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance">
		<dc:title>${encodeXmlEntities(title)}</dc:title>
		<dc:subject>${encodeXmlEntities(subject)}</dc:subject>
		<dc:creator>${encodeXmlEntities(author)}</dc:creator>
		<cp:lastModifiedBy>${encodeXmlEntities(author)}</cp:lastModifiedBy>
		<cp:revision>${revision}</cp:revision>
		<dcterms:created xsi:type="dcterms:W3CDTF">${(/* @__PURE__ */ new Date()).toISOString().replace(/\.\d\d\dZ/, "Z")}</dcterms:created>
		<dcterms:modified xsi:type="dcterms:W3CDTF">${(/* @__PURE__ */ new Date()).toISOString().replace(/\.\d\d\dZ/, "Z")}</dcterms:modified>
	</cp:coreProperties>`;
}
function makeXmlPresentationRels(slides) {
  let intRelNum = 1;
  let strXml = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' + CRLF;
  strXml += '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">';
  strXml += '<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/slideMaster" Target="slideMasters/slideMaster1.xml"/>';
  for (let idx = 1; idx <= slides.length; idx++) {
    strXml += `<Relationship Id="rId${++intRelNum}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/slide" Target="slides/slide${idx}.xml"/>`;
  }
  intRelNum++;
  strXml += `<Relationship Id="rId${intRelNum + 0}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/notesMaster" Target="notesMasters/notesMaster1.xml"/><Relationship Id="rId${intRelNum + 1}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/presProps" Target="presProps.xml"/><Relationship Id="rId${intRelNum + 2}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/viewProps" Target="viewProps.xml"/><Relationship Id="rId${intRelNum + 3}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/theme" Target="theme/theme1.xml"/><Relationship Id="rId${intRelNum + 4}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/tableStyles" Target="tableStyles.xml"/></Relationships>`;
  return strXml;
}
function makeXmlSlide(slide) {
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>${CRLF}<p:sld xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships" xmlns:p="http://schemas.openxmlformats.org/presentationml/2006/main"${(slide === null || slide === void 0 ? void 0 : slide.hidden) ? ' show="0"' : ""}>${slideObjectToXml(slide)}<p:clrMapOvr><a:masterClrMapping/></p:clrMapOvr></p:sld>`;
}
function getNotesFromSlide(slide) {
  let notesText = "";
  slide._slideObjects.forEach((data) => {
    if (data._type === SLIDE_OBJECT_TYPES.notes)
      notesText += (data === null || data === void 0 ? void 0 : data.text) && data.text[0] ? data.text[0].text : "";
  });
  return notesText.replace(/\r*\n/g, CRLF);
}
function makeXmlNotesMaster() {
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>${CRLF}<p:notesMaster xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships" xmlns:p="http://schemas.openxmlformats.org/presentationml/2006/main"><p:cSld><p:bg><p:bgRef idx="1001"><a:schemeClr val="bg1"/></p:bgRef></p:bg><p:spTree><p:nvGrpSpPr><p:cNvPr id="1" name=""/><p:cNvGrpSpPr/><p:nvPr/></p:nvGrpSpPr><p:grpSpPr><a:xfrm><a:off x="0" y="0"/><a:ext cx="0" cy="0"/><a:chOff x="0" y="0"/><a:chExt cx="0" cy="0"/></a:xfrm></p:grpSpPr><p:sp><p:nvSpPr><p:cNvPr id="2" name="Header Placeholder 1"/><p:cNvSpPr><a:spLocks noGrp="1"/></p:cNvSpPr><p:nvPr><p:ph type="hdr" sz="quarter"/></p:nvPr></p:nvSpPr><p:spPr><a:xfrm><a:off x="0" y="0"/><a:ext cx="2971800" cy="458788"/></a:xfrm><a:prstGeom prst="rect"><a:avLst/></a:prstGeom></p:spPr><p:txBody><a:bodyPr vert="horz" lIns="91440" tIns="45720" rIns="91440" bIns="45720" rtlCol="0"/><a:lstStyle><a:lvl1pPr algn="l"><a:defRPr sz="1200"/></a:lvl1pPr></a:lstStyle><a:p><a:endParaRPr lang="en-US"/></a:p></p:txBody></p:sp><p:sp><p:nvSpPr><p:cNvPr id="3" name="Date Placeholder 2"/><p:cNvSpPr><a:spLocks noGrp="1"/></p:cNvSpPr><p:nvPr><p:ph type="dt" idx="1"/></p:nvPr></p:nvSpPr><p:spPr><a:xfrm><a:off x="3884613" y="0"/><a:ext cx="2971800" cy="458788"/></a:xfrm><a:prstGeom prst="rect"><a:avLst/></a:prstGeom></p:spPr><p:txBody><a:bodyPr vert="horz" lIns="91440" tIns="45720" rIns="91440" bIns="45720" rtlCol="0"/><a:lstStyle><a:lvl1pPr algn="r"><a:defRPr sz="1200"/></a:lvl1pPr></a:lstStyle><a:p><a:fld id="{5282F153-3F37-0F45-9E97-73ACFA13230C}" type="datetimeFigureOut"><a:rPr lang="en-US"/><a:t>7/23/19</a:t></a:fld><a:endParaRPr lang="en-US"/></a:p></p:txBody></p:sp><p:sp><p:nvSpPr><p:cNvPr id="4" name="Slide Image Placeholder 3"/><p:cNvSpPr><a:spLocks noGrp="1" noRot="1" noChangeAspect="1"/></p:cNvSpPr><p:nvPr><p:ph type="sldImg" idx="2"/></p:nvPr></p:nvSpPr><p:spPr><a:xfrm><a:off x="685800" y="1143000"/><a:ext cx="5486400" cy="3086100"/></a:xfrm><a:prstGeom prst="rect"><a:avLst/></a:prstGeom><a:noFill/><a:ln w="12700"><a:solidFill><a:prstClr val="black"/></a:solidFill></a:ln></p:spPr><p:txBody><a:bodyPr vert="horz" lIns="91440" tIns="45720" rIns="91440" bIns="45720" rtlCol="0" anchor="ctr"/><a:lstStyle/><a:p><a:endParaRPr lang="en-US"/></a:p></p:txBody></p:sp><p:sp><p:nvSpPr><p:cNvPr id="5" name="Notes Placeholder 4"/><p:cNvSpPr><a:spLocks noGrp="1"/></p:cNvSpPr><p:nvPr><p:ph type="body" sz="quarter" idx="3"/></p:nvPr></p:nvSpPr><p:spPr><a:xfrm><a:off x="685800" y="4400550"/><a:ext cx="5486400" cy="3600450"/></a:xfrm><a:prstGeom prst="rect"><a:avLst/></a:prstGeom></p:spPr><p:txBody><a:bodyPr vert="horz" lIns="91440" tIns="45720" rIns="91440" bIns="45720" rtlCol="0"/><a:lstStyle/><a:p><a:pPr lvl="0"/><a:r><a:rPr lang="en-US"/><a:t>Click to edit Master text styles</a:t></a:r></a:p><a:p><a:pPr lvl="1"/><a:r><a:rPr lang="en-US"/><a:t>Second level</a:t></a:r></a:p><a:p><a:pPr lvl="2"/><a:r><a:rPr lang="en-US"/><a:t>Third level</a:t></a:r></a:p><a:p><a:pPr lvl="3"/><a:r><a:rPr lang="en-US"/><a:t>Fourth level</a:t></a:r></a:p><a:p><a:pPr lvl="4"/><a:r><a:rPr lang="en-US"/><a:t>Fifth level</a:t></a:r></a:p></p:txBody></p:sp><p:sp><p:nvSpPr><p:cNvPr id="6" name="Footer Placeholder 5"/><p:cNvSpPr><a:spLocks noGrp="1"/></p:cNvSpPr><p:nvPr><p:ph type="ftr" sz="quarter" idx="4"/></p:nvPr></p:nvSpPr><p:spPr><a:xfrm><a:off x="0" y="8685213"/><a:ext cx="2971800" cy="458787"/></a:xfrm><a:prstGeom prst="rect"><a:avLst/></a:prstGeom></p:spPr><p:txBody><a:bodyPr vert="horz" lIns="91440" tIns="45720" rIns="91440" bIns="45720" rtlCol="0" anchor="b"/><a:lstStyle><a:lvl1pPr algn="l"><a:defRPr sz="1200"/></a:lvl1pPr></a:lstStyle><a:p><a:endParaRPr lang="en-US"/></a:p></p:txBody></p:sp><p:sp><p:nvSpPr><p:cNvPr id="7" name="Slide Number Placeholder 6"/><p:cNvSpPr><a:spLocks noGrp="1"/></p:cNvSpPr><p:nvPr><p:ph type="sldNum" sz="quarter" idx="5"/></p:nvPr></p:nvSpPr><p:spPr><a:xfrm><a:off x="3884613" y="8685213"/><a:ext cx="2971800" cy="458787"/></a:xfrm><a:prstGeom prst="rect"><a:avLst/></a:prstGeom></p:spPr><p:txBody><a:bodyPr vert="horz" lIns="91440" tIns="45720" rIns="91440" bIns="45720" rtlCol="0" anchor="b"/><a:lstStyle><a:lvl1pPr algn="r"><a:defRPr sz="1200"/></a:lvl1pPr></a:lstStyle><a:p><a:fld id="{CE5E9CC1-C706-0F49-92D6-E571CC5EEA8F}" type="slidenum"><a:rPr lang="en-US"/><a:t>\u2039#\u203A</a:t></a:fld><a:endParaRPr lang="en-US"/></a:p></p:txBody></p:sp></p:spTree><p:extLst><p:ext uri="{BB962C8B-B14F-4D97-AF65-F5344CB8AC3E}"><p14:creationId xmlns:p14="http://schemas.microsoft.com/office/powerpoint/2010/main" val="1024086991"/></p:ext></p:extLst></p:cSld><p:clrMap bg1="lt1" tx1="dk1" bg2="lt2" tx2="dk2" accent1="accent1" accent2="accent2" accent3="accent3" accent4="accent4" accent5="accent5" accent6="accent6" hlink="hlink" folHlink="folHlink"/><p:notesStyle><a:lvl1pPr marL="0" algn="l" defTabSz="914400" rtl="0" eaLnBrk="1" latinLnBrk="0" hangingPunct="1"><a:defRPr sz="1200" kern="1200"><a:solidFill><a:schemeClr val="tx1"/></a:solidFill><a:latin typeface="+mn-lt"/><a:ea typeface="+mn-ea"/><a:cs typeface="+mn-cs"/></a:defRPr></a:lvl1pPr><a:lvl2pPr marL="457200" algn="l" defTabSz="914400" rtl="0" eaLnBrk="1" latinLnBrk="0" hangingPunct="1"><a:defRPr sz="1200" kern="1200"><a:solidFill><a:schemeClr val="tx1"/></a:solidFill><a:latin typeface="+mn-lt"/><a:ea typeface="+mn-ea"/><a:cs typeface="+mn-cs"/></a:defRPr></a:lvl2pPr><a:lvl3pPr marL="914400" algn="l" defTabSz="914400" rtl="0" eaLnBrk="1" latinLnBrk="0" hangingPunct="1"><a:defRPr sz="1200" kern="1200"><a:solidFill><a:schemeClr val="tx1"/></a:solidFill><a:latin typeface="+mn-lt"/><a:ea typeface="+mn-ea"/><a:cs typeface="+mn-cs"/></a:defRPr></a:lvl3pPr><a:lvl4pPr marL="1371600" algn="l" defTabSz="914400" rtl="0" eaLnBrk="1" latinLnBrk="0" hangingPunct="1"><a:defRPr sz="1200" kern="1200"><a:solidFill><a:schemeClr val="tx1"/></a:solidFill><a:latin typeface="+mn-lt"/><a:ea typeface="+mn-ea"/><a:cs typeface="+mn-cs"/></a:defRPr></a:lvl4pPr><a:lvl5pPr marL="1828800" algn="l" defTabSz="914400" rtl="0" eaLnBrk="1" latinLnBrk="0" hangingPunct="1"><a:defRPr sz="1200" kern="1200"><a:solidFill><a:schemeClr val="tx1"/></a:solidFill><a:latin typeface="+mn-lt"/><a:ea typeface="+mn-ea"/><a:cs typeface="+mn-cs"/></a:defRPr></a:lvl5pPr><a:lvl6pPr marL="2286000" algn="l" defTabSz="914400" rtl="0" eaLnBrk="1" latinLnBrk="0" hangingPunct="1"><a:defRPr sz="1200" kern="1200"><a:solidFill><a:schemeClr val="tx1"/></a:solidFill><a:latin typeface="+mn-lt"/><a:ea typeface="+mn-ea"/><a:cs typeface="+mn-cs"/></a:defRPr></a:lvl6pPr><a:lvl7pPr marL="2743200" algn="l" defTabSz="914400" rtl="0" eaLnBrk="1" latinLnBrk="0" hangingPunct="1"><a:defRPr sz="1200" kern="1200"><a:solidFill><a:schemeClr val="tx1"/></a:solidFill><a:latin typeface="+mn-lt"/><a:ea typeface="+mn-ea"/><a:cs typeface="+mn-cs"/></a:defRPr></a:lvl7pPr><a:lvl8pPr marL="3200400" algn="l" defTabSz="914400" rtl="0" eaLnBrk="1" latinLnBrk="0" hangingPunct="1"><a:defRPr sz="1200" kern="1200"><a:solidFill><a:schemeClr val="tx1"/></a:solidFill><a:latin typeface="+mn-lt"/><a:ea typeface="+mn-ea"/><a:cs typeface="+mn-cs"/></a:defRPr></a:lvl8pPr><a:lvl9pPr marL="3657600" algn="l" defTabSz="914400" rtl="0" eaLnBrk="1" latinLnBrk="0" hangingPunct="1"><a:defRPr sz="1200" kern="1200"><a:solidFill><a:schemeClr val="tx1"/></a:solidFill><a:latin typeface="+mn-lt"/><a:ea typeface="+mn-ea"/><a:cs typeface="+mn-cs"/></a:defRPr></a:lvl9pPr></p:notesStyle></p:notesMaster>`;
}
function makeXmlNotesSlide(slide) {
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>${CRLF}<p:notes xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships" xmlns:p="http://schemas.openxmlformats.org/presentationml/2006/main"><p:cSld><p:spTree><p:nvGrpSpPr><p:cNvPr id="1" name=""/><p:cNvGrpSpPr/><p:nvPr/></p:nvGrpSpPr><p:grpSpPr><a:xfrm><a:off x="0" y="0"/><a:ext cx="0" cy="0"/><a:chOff x="0" y="0"/><a:chExt cx="0" cy="0"/></a:xfrm></p:grpSpPr><p:sp><p:nvSpPr><p:cNvPr id="2" name="Slide Image Placeholder 1"/><p:cNvSpPr><a:spLocks noGrp="1" noRot="1" noChangeAspect="1"/></p:cNvSpPr><p:nvPr><p:ph type="sldImg"/></p:nvPr></p:nvSpPr><p:spPr/></p:sp><p:sp><p:nvSpPr><p:cNvPr id="3" name="Notes Placeholder 2"/><p:cNvSpPr><a:spLocks noGrp="1"/></p:cNvSpPr><p:nvPr><p:ph type="body" idx="1"/></p:nvPr></p:nvSpPr><p:spPr/><p:txBody><a:bodyPr/><a:lstStyle/><a:p><a:r><a:rPr lang="en-US" dirty="0"/><a:t>${encodeXmlEntities(getNotesFromSlide(slide))}</a:t></a:r><a:endParaRPr lang="en-US" dirty="0"/></a:p></p:txBody></p:sp><p:sp><p:nvSpPr><p:cNvPr id="4" name="Slide Number Placeholder 3"/><p:cNvSpPr><a:spLocks noGrp="1"/></p:cNvSpPr><p:nvPr><p:ph type="sldNum" sz="quarter" idx="10"/></p:nvPr></p:nvSpPr><p:spPr/><p:txBody><a:bodyPr/><a:lstStyle/><a:p><a:fld id="${SLDNUMFLDID}" type="slidenum"><a:rPr lang="en-US"/><a:t>${slide._slideNum}</a:t></a:fld><a:endParaRPr lang="en-US"/></a:p></p:txBody></p:sp></p:spTree><p:extLst><p:ext uri="{BB962C8B-B14F-4D97-AF65-F5344CB8AC3E}"><p14:creationId xmlns:p14="http://schemas.microsoft.com/office/powerpoint/2010/main" val="1024086991"/></p:ext></p:extLst></p:cSld><p:clrMapOvr><a:masterClrMapping/></p:clrMapOvr></p:notes>`;
}
function makeXmlLayout(layout) {
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
		<p:sldLayout xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships" xmlns:p="http://schemas.openxmlformats.org/presentationml/2006/main" preserve="1">
		${slideObjectToXml(layout)}
		<p:clrMapOvr><a:masterClrMapping/></p:clrMapOvr></p:sldLayout>`;
}
function makeXmlMaster(slide, layouts) {
  const layoutDefs = layouts.map((_layoutDef, idx) => `<p:sldLayoutId id="${LAYOUT_IDX_SERIES_BASE + idx}" r:id="rId${slide._rels.length + idx + 1}"/>`);
  let strXml = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' + CRLF;
  strXml += '<p:sldMaster xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships" xmlns:p="http://schemas.openxmlformats.org/presentationml/2006/main">';
  strXml += slideObjectToXml(slide);
  strXml += '<p:clrMap bg1="lt1" tx1="dk1" bg2="lt2" tx2="dk2" accent1="accent1" accent2="accent2" accent3="accent3" accent4="accent4" accent5="accent5" accent6="accent6" hlink="hlink" folHlink="folHlink"/>';
  strXml += "<p:sldLayoutIdLst>" + layoutDefs.join("") + "</p:sldLayoutIdLst>";
  strXml += '<p:hf sldNum="0" hdr="0" ftr="0" dt="0"/>';
  strXml += '<p:txStyles> <p:titleStyle>  <a:lvl1pPr algn="ctr" defTabSz="914400" rtl="0" eaLnBrk="1" latinLnBrk="0" hangingPunct="1"><a:spcBef><a:spcPct val="0"/></a:spcBef><a:buNone/><a:defRPr sz="4400" kern="1200"><a:solidFill><a:schemeClr val="tx1"/></a:solidFill><a:latin typeface="+mj-lt"/><a:ea typeface="+mj-ea"/><a:cs typeface="+mj-cs"/></a:defRPr></a:lvl1pPr> </p:titleStyle> <p:bodyStyle>  <a:lvl1pPr marL="342900" indent="-342900" algn="l" defTabSz="914400" rtl="0" eaLnBrk="1" latinLnBrk="0" hangingPunct="1"><a:spcBef><a:spcPct val="20000"/></a:spcBef><a:buFont typeface="Arial" pitchFamily="34" charset="0"/><a:buChar char="\u2022"/><a:defRPr sz="3200" kern="1200"><a:solidFill><a:schemeClr val="tx1"/></a:solidFill><a:latin typeface="+mn-lt"/><a:ea typeface="+mn-ea"/><a:cs typeface="+mn-cs"/></a:defRPr></a:lvl1pPr>  <a:lvl2pPr marL="742950" indent="-285750" algn="l" defTabSz="914400" rtl="0" eaLnBrk="1" latinLnBrk="0" hangingPunct="1"><a:spcBef><a:spcPct val="20000"/></a:spcBef><a:buFont typeface="Arial" pitchFamily="34" charset="0"/><a:buChar char="\u2013"/><a:defRPr sz="2800" kern="1200"><a:solidFill><a:schemeClr val="tx1"/></a:solidFill><a:latin typeface="+mn-lt"/><a:ea typeface="+mn-ea"/><a:cs typeface="+mn-cs"/></a:defRPr></a:lvl2pPr>  <a:lvl3pPr marL="1143000" indent="-228600" algn="l" defTabSz="914400" rtl="0" eaLnBrk="1" latinLnBrk="0" hangingPunct="1"><a:spcBef><a:spcPct val="20000"/></a:spcBef><a:buFont typeface="Arial" pitchFamily="34" charset="0"/><a:buChar char="\u2022"/><a:defRPr sz="2400" kern="1200"><a:solidFill><a:schemeClr val="tx1"/></a:solidFill><a:latin typeface="+mn-lt"/><a:ea typeface="+mn-ea"/><a:cs typeface="+mn-cs"/></a:defRPr></a:lvl3pPr>  <a:lvl4pPr marL="1600200" indent="-228600" algn="l" defTabSz="914400" rtl="0" eaLnBrk="1" latinLnBrk="0" hangingPunct="1"><a:spcBef><a:spcPct val="20000"/></a:spcBef><a:buFont typeface="Arial" pitchFamily="34" charset="0"/><a:buChar char="\u2013"/><a:defRPr sz="2000" kern="1200"><a:solidFill><a:schemeClr val="tx1"/></a:solidFill><a:latin typeface="+mn-lt"/><a:ea typeface="+mn-ea"/><a:cs typeface="+mn-cs"/></a:defRPr></a:lvl4pPr>  <a:lvl5pPr marL="2057400" indent="-228600" algn="l" defTabSz="914400" rtl="0" eaLnBrk="1" latinLnBrk="0" hangingPunct="1"><a:spcBef><a:spcPct val="20000"/></a:spcBef><a:buFont typeface="Arial" pitchFamily="34" charset="0"/><a:buChar char="\xBB"/><a:defRPr sz="2000" kern="1200"><a:solidFill><a:schemeClr val="tx1"/></a:solidFill><a:latin typeface="+mn-lt"/><a:ea typeface="+mn-ea"/><a:cs typeface="+mn-cs"/></a:defRPr></a:lvl5pPr>  <a:lvl6pPr marL="2514600" indent="-228600" algn="l" defTabSz="914400" rtl="0" eaLnBrk="1" latinLnBrk="0" hangingPunct="1"><a:spcBef><a:spcPct val="20000"/></a:spcBef><a:buFont typeface="Arial" pitchFamily="34" charset="0"/><a:buChar char="\u2022"/><a:defRPr sz="2000" kern="1200"><a:solidFill><a:schemeClr val="tx1"/></a:solidFill><a:latin typeface="+mn-lt"/><a:ea typeface="+mn-ea"/><a:cs typeface="+mn-cs"/></a:defRPr></a:lvl6pPr>  <a:lvl7pPr marL="2971800" indent="-228600" algn="l" defTabSz="914400" rtl="0" eaLnBrk="1" latinLnBrk="0" hangingPunct="1"><a:spcBef><a:spcPct val="20000"/></a:spcBef><a:buFont typeface="Arial" pitchFamily="34" charset="0"/><a:buChar char="\u2022"/><a:defRPr sz="2000" kern="1200"><a:solidFill><a:schemeClr val="tx1"/></a:solidFill><a:latin typeface="+mn-lt"/><a:ea typeface="+mn-ea"/><a:cs typeface="+mn-cs"/></a:defRPr></a:lvl7pPr>  <a:lvl8pPr marL="3429000" indent="-228600" algn="l" defTabSz="914400" rtl="0" eaLnBrk="1" latinLnBrk="0" hangingPunct="1"><a:spcBef><a:spcPct val="20000"/></a:spcBef><a:buFont typeface="Arial" pitchFamily="34" charset="0"/><a:buChar char="\u2022"/><a:defRPr sz="2000" kern="1200"><a:solidFill><a:schemeClr val="tx1"/></a:solidFill><a:latin typeface="+mn-lt"/><a:ea typeface="+mn-ea"/><a:cs typeface="+mn-cs"/></a:defRPr></a:lvl8pPr>  <a:lvl9pPr marL="3886200" indent="-228600" algn="l" defTabSz="914400" rtl="0" eaLnBrk="1" latinLnBrk="0" hangingPunct="1"><a:spcBef><a:spcPct val="20000"/></a:spcBef><a:buFont typeface="Arial" pitchFamily="34" charset="0"/><a:buChar char="\u2022"/><a:defRPr sz="2000" kern="1200"><a:solidFill><a:schemeClr val="tx1"/></a:solidFill><a:latin typeface="+mn-lt"/><a:ea typeface="+mn-ea"/><a:cs typeface="+mn-cs"/></a:defRPr></a:lvl9pPr> </p:bodyStyle> <p:otherStyle>  <a:defPPr><a:defRPr lang="en-US"/></a:defPPr>  <a:lvl1pPr marL="0" algn="l" defTabSz="914400" rtl="0" eaLnBrk="1" latinLnBrk="0" hangingPunct="1"><a:defRPr sz="1800" kern="1200"><a:solidFill><a:schemeClr val="tx1"/></a:solidFill><a:latin typeface="+mn-lt"/><a:ea typeface="+mn-ea"/><a:cs typeface="+mn-cs"/></a:defRPr></a:lvl1pPr>  <a:lvl2pPr marL="457200" algn="l" defTabSz="914400" rtl="0" eaLnBrk="1" latinLnBrk="0" hangingPunct="1"><a:defRPr sz="1800" kern="1200"><a:solidFill><a:schemeClr val="tx1"/></a:solidFill><a:latin typeface="+mn-lt"/><a:ea typeface="+mn-ea"/><a:cs typeface="+mn-cs"/></a:defRPr></a:lvl2pPr>  <a:lvl3pPr marL="914400" algn="l" defTabSz="914400" rtl="0" eaLnBrk="1" latinLnBrk="0" hangingPunct="1"><a:defRPr sz="1800" kern="1200"><a:solidFill><a:schemeClr val="tx1"/></a:solidFill><a:latin typeface="+mn-lt"/><a:ea typeface="+mn-ea"/><a:cs typeface="+mn-cs"/></a:defRPr></a:lvl3pPr>  <a:lvl4pPr marL="1371600" algn="l" defTabSz="914400" rtl="0" eaLnBrk="1" latinLnBrk="0" hangingPunct="1"><a:defRPr sz="1800" kern="1200"><a:solidFill><a:schemeClr val="tx1"/></a:solidFill><a:latin typeface="+mn-lt"/><a:ea typeface="+mn-ea"/><a:cs typeface="+mn-cs"/></a:defRPr></a:lvl4pPr>  <a:lvl5pPr marL="1828800" algn="l" defTabSz="914400" rtl="0" eaLnBrk="1" latinLnBrk="0" hangingPunct="1"><a:defRPr sz="1800" kern="1200"><a:solidFill><a:schemeClr val="tx1"/></a:solidFill><a:latin typeface="+mn-lt"/><a:ea typeface="+mn-ea"/><a:cs typeface="+mn-cs"/></a:defRPr></a:lvl5pPr>  <a:lvl6pPr marL="2286000" algn="l" defTabSz="914400" rtl="0" eaLnBrk="1" latinLnBrk="0" hangingPunct="1"><a:defRPr sz="1800" kern="1200"><a:solidFill><a:schemeClr val="tx1"/></a:solidFill><a:latin typeface="+mn-lt"/><a:ea typeface="+mn-ea"/><a:cs typeface="+mn-cs"/></a:defRPr></a:lvl6pPr>  <a:lvl7pPr marL="2743200" algn="l" defTabSz="914400" rtl="0" eaLnBrk="1" latinLnBrk="0" hangingPunct="1"><a:defRPr sz="1800" kern="1200"><a:solidFill><a:schemeClr val="tx1"/></a:solidFill><a:latin typeface="+mn-lt"/><a:ea typeface="+mn-ea"/><a:cs typeface="+mn-cs"/></a:defRPr></a:lvl7pPr>  <a:lvl8pPr marL="3200400" algn="l" defTabSz="914400" rtl="0" eaLnBrk="1" latinLnBrk="0" hangingPunct="1"><a:defRPr sz="1800" kern="1200"><a:solidFill><a:schemeClr val="tx1"/></a:solidFill><a:latin typeface="+mn-lt"/><a:ea typeface="+mn-ea"/><a:cs typeface="+mn-cs"/></a:defRPr></a:lvl8pPr>  <a:lvl9pPr marL="3657600" algn="l" defTabSz="914400" rtl="0" eaLnBrk="1" latinLnBrk="0" hangingPunct="1"><a:defRPr sz="1800" kern="1200"><a:solidFill><a:schemeClr val="tx1"/></a:solidFill><a:latin typeface="+mn-lt"/><a:ea typeface="+mn-ea"/><a:cs typeface="+mn-cs"/></a:defRPr></a:lvl9pPr> </p:otherStyle></p:txStyles>';
  strXml += "</p:sldMaster>";
  return strXml;
}
function makeXmlSlideLayoutRel(layoutNumber, slideLayouts) {
  return slideObjectRelationsToXml(slideLayouts[layoutNumber - 1], [
    {
      target: "../slideMasters/slideMaster1.xml",
      type: "http://schemas.openxmlformats.org/officeDocument/2006/relationships/slideMaster"
    }
  ]);
}
function makeXmlSlideRel(slides, slideLayouts, slideNumber) {
  return slideObjectRelationsToXml(slides[slideNumber - 1], [
    {
      target: `../slideLayouts/slideLayout${getLayoutIdxForSlide(slides, slideLayouts, slideNumber)}.xml`,
      type: "http://schemas.openxmlformats.org/officeDocument/2006/relationships/slideLayout"
    },
    {
      target: `../notesSlides/notesSlide${slideNumber}.xml`,
      type: "http://schemas.openxmlformats.org/officeDocument/2006/relationships/notesSlide"
    }
  ]);
}
function makeXmlNotesSlideRel(slideNumber) {
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
		<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
			<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/notesMaster" Target="../notesMasters/notesMaster1.xml"/>
			<Relationship Id="rId2" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/slide" Target="../slides/slide${slideNumber}.xml"/>
		</Relationships>`;
}
function makeXmlMasterRel(masterSlide, slideLayouts) {
  const defaultRels = slideLayouts.map((_layoutDef, idx) => ({
    target: `../slideLayouts/slideLayout${idx + 1}.xml`,
    type: "http://schemas.openxmlformats.org/officeDocument/2006/relationships/slideLayout"
  }));
  defaultRels.push({ target: "../theme/theme1.xml", type: "http://schemas.openxmlformats.org/officeDocument/2006/relationships/theme" });
  return slideObjectRelationsToXml(masterSlide, defaultRels);
}
function makeXmlNotesMasterRel() {
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>${CRLF}<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
		<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/theme" Target="../theme/theme1.xml"/>
		</Relationships>`;
}
function getLayoutIdxForSlide(slides, slideLayouts, slideNumber) {
  for (let i = 0; i < slideLayouts.length; i++) {
    if (slideLayouts[i]._name === slides[slideNumber - 1]._slideLayout._name) {
      return i + 1;
    }
  }
  return 1;
}
function makeXmlTheme(pres) {
  var _a, _b, _c, _d;
  const majorFont = ((_a = pres.theme) === null || _a === void 0 ? void 0 : _a.headFontFace) ? `<a:latin typeface="${(_b = pres.theme) === null || _b === void 0 ? void 0 : _b.headFontFace}"/>` : '<a:latin typeface="Calibri Light" panose="020F0302020204030204"/>';
  const minorFont = ((_c = pres.theme) === null || _c === void 0 ? void 0 : _c.bodyFontFace) ? `<a:latin typeface="${(_d = pres.theme) === null || _d === void 0 ? void 0 : _d.bodyFontFace}"/>` : '<a:latin typeface="Calibri" panose="020F0502020204030204"/>';
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><a:theme xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main" name="Office Theme"><a:themeElements><a:clrScheme name="Office"><a:dk1><a:sysClr val="windowText" lastClr="000000"/></a:dk1><a:lt1><a:sysClr val="window" lastClr="FFFFFF"/></a:lt1><a:dk2><a:srgbClr val="44546A"/></a:dk2><a:lt2><a:srgbClr val="E7E6E6"/></a:lt2><a:accent1><a:srgbClr val="4472C4"/></a:accent1><a:accent2><a:srgbClr val="ED7D31"/></a:accent2><a:accent3><a:srgbClr val="A5A5A5"/></a:accent3><a:accent4><a:srgbClr val="FFC000"/></a:accent4><a:accent5><a:srgbClr val="5B9BD5"/></a:accent5><a:accent6><a:srgbClr val="70AD47"/></a:accent6><a:hlink><a:srgbClr val="0563C1"/></a:hlink><a:folHlink><a:srgbClr val="954F72"/></a:folHlink></a:clrScheme><a:fontScheme name="Office"><a:majorFont>${majorFont}<a:ea typeface=""/><a:cs typeface=""/><a:font script="Jpan" typeface="\u6E38\u30B4\u30B7\u30C3\u30AF Light"/><a:font script="Hang" typeface="\uB9D1\uC740 \uACE0\uB515"/><a:font script="Hans" typeface="\u7B49\u7EBF Light"/><a:font script="Hant" typeface="\u65B0\u7D30\u660E\u9AD4"/><a:font script="Arab" typeface="Times New Roman"/><a:font script="Hebr" typeface="Times New Roman"/><a:font script="Thai" typeface="Angsana New"/><a:font script="Ethi" typeface="Nyala"/><a:font script="Beng" typeface="Vrinda"/><a:font script="Gujr" typeface="Shruti"/><a:font script="Khmr" typeface="MoolBoran"/><a:font script="Knda" typeface="Tunga"/><a:font script="Guru" typeface="Raavi"/><a:font script="Cans" typeface="Euphemia"/><a:font script="Cher" typeface="Plantagenet Cherokee"/><a:font script="Yiii" typeface="Microsoft Yi Baiti"/><a:font script="Tibt" typeface="Microsoft Himalaya"/><a:font script="Thaa" typeface="MV Boli"/><a:font script="Deva" typeface="Mangal"/><a:font script="Telu" typeface="Gautami"/><a:font script="Taml" typeface="Latha"/><a:font script="Syrc" typeface="Estrangelo Edessa"/><a:font script="Orya" typeface="Kalinga"/><a:font script="Mlym" typeface="Kartika"/><a:font script="Laoo" typeface="DokChampa"/><a:font script="Sinh" typeface="Iskoola Pota"/><a:font script="Mong" typeface="Mongolian Baiti"/><a:font script="Viet" typeface="Times New Roman"/><a:font script="Uigh" typeface="Microsoft Uighur"/><a:font script="Geor" typeface="Sylfaen"/><a:font script="Armn" typeface="Arial"/><a:font script="Bugi" typeface="Leelawadee UI"/><a:font script="Bopo" typeface="Microsoft JhengHei"/><a:font script="Java" typeface="Javanese Text"/><a:font script="Lisu" typeface="Segoe UI"/><a:font script="Mymr" typeface="Myanmar Text"/><a:font script="Nkoo" typeface="Ebrima"/><a:font script="Olck" typeface="Nirmala UI"/><a:font script="Osma" typeface="Ebrima"/><a:font script="Phag" typeface="Phagspa"/><a:font script="Syrn" typeface="Estrangelo Edessa"/><a:font script="Syrj" typeface="Estrangelo Edessa"/><a:font script="Syre" typeface="Estrangelo Edessa"/><a:font script="Sora" typeface="Nirmala UI"/><a:font script="Tale" typeface="Microsoft Tai Le"/><a:font script="Talu" typeface="Microsoft New Tai Lue"/><a:font script="Tfng" typeface="Ebrima"/></a:majorFont><a:minorFont>${minorFont}<a:ea typeface=""/><a:cs typeface=""/><a:font script="Jpan" typeface="\u6E38\u30B4\u30B7\u30C3\u30AF"/><a:font script="Hang" typeface="\uB9D1\uC740 \uACE0\uB515"/><a:font script="Hans" typeface="\u7B49\u7EBF"/><a:font script="Hant" typeface="\u65B0\u7D30\u660E\u9AD4"/><a:font script="Arab" typeface="Arial"/><a:font script="Hebr" typeface="Arial"/><a:font script="Thai" typeface="Cordia New"/><a:font script="Ethi" typeface="Nyala"/><a:font script="Beng" typeface="Vrinda"/><a:font script="Gujr" typeface="Shruti"/><a:font script="Khmr" typeface="DaunPenh"/><a:font script="Knda" typeface="Tunga"/><a:font script="Guru" typeface="Raavi"/><a:font script="Cans" typeface="Euphemia"/><a:font script="Cher" typeface="Plantagenet Cherokee"/><a:font script="Yiii" typeface="Microsoft Yi Baiti"/><a:font script="Tibt" typeface="Microsoft Himalaya"/><a:font script="Thaa" typeface="MV Boli"/><a:font script="Deva" typeface="Mangal"/><a:font script="Telu" typeface="Gautami"/><a:font script="Taml" typeface="Latha"/><a:font script="Syrc" typeface="Estrangelo Edessa"/><a:font script="Orya" typeface="Kalinga"/><a:font script="Mlym" typeface="Kartika"/><a:font script="Laoo" typeface="DokChampa"/><a:font script="Sinh" typeface="Iskoola Pota"/><a:font script="Mong" typeface="Mongolian Baiti"/><a:font script="Viet" typeface="Arial"/><a:font script="Uigh" typeface="Microsoft Uighur"/><a:font script="Geor" typeface="Sylfaen"/><a:font script="Armn" typeface="Arial"/><a:font script="Bugi" typeface="Leelawadee UI"/><a:font script="Bopo" typeface="Microsoft JhengHei"/><a:font script="Java" typeface="Javanese Text"/><a:font script="Lisu" typeface="Segoe UI"/><a:font script="Mymr" typeface="Myanmar Text"/><a:font script="Nkoo" typeface="Ebrima"/><a:font script="Olck" typeface="Nirmala UI"/><a:font script="Osma" typeface="Ebrima"/><a:font script="Phag" typeface="Phagspa"/><a:font script="Syrn" typeface="Estrangelo Edessa"/><a:font script="Syrj" typeface="Estrangelo Edessa"/><a:font script="Syre" typeface="Estrangelo Edessa"/><a:font script="Sora" typeface="Nirmala UI"/><a:font script="Tale" typeface="Microsoft Tai Le"/><a:font script="Talu" typeface="Microsoft New Tai Lue"/><a:font script="Tfng" typeface="Ebrima"/></a:minorFont></a:fontScheme><a:fmtScheme name="Office"><a:fillStyleLst><a:solidFill><a:schemeClr val="phClr"/></a:solidFill><a:gradFill rotWithShape="1"><a:gsLst><a:gs pos="0"><a:schemeClr val="phClr"><a:lumMod val="110000"/><a:satMod val="105000"/><a:tint val="67000"/></a:schemeClr></a:gs><a:gs pos="50000"><a:schemeClr val="phClr"><a:lumMod val="105000"/><a:satMod val="103000"/><a:tint val="73000"/></a:schemeClr></a:gs><a:gs pos="100000"><a:schemeClr val="phClr"><a:lumMod val="105000"/><a:satMod val="109000"/><a:tint val="81000"/></a:schemeClr></a:gs></a:gsLst><a:lin ang="5400000" scaled="0"/></a:gradFill><a:gradFill rotWithShape="1"><a:gsLst><a:gs pos="0"><a:schemeClr val="phClr"><a:satMod val="103000"/><a:lumMod val="102000"/><a:tint val="94000"/></a:schemeClr></a:gs><a:gs pos="50000"><a:schemeClr val="phClr"><a:satMod val="110000"/><a:lumMod val="100000"/><a:shade val="100000"/></a:schemeClr></a:gs><a:gs pos="100000"><a:schemeClr val="phClr"><a:lumMod val="99000"/><a:satMod val="120000"/><a:shade val="78000"/></a:schemeClr></a:gs></a:gsLst><a:lin ang="5400000" scaled="0"/></a:gradFill></a:fillStyleLst><a:lnStyleLst><a:ln w="6350" cap="flat" cmpd="sng" algn="ctr"><a:solidFill><a:schemeClr val="phClr"/></a:solidFill><a:prstDash val="solid"/><a:miter lim="800000"/></a:ln><a:ln w="12700" cap="flat" cmpd="sng" algn="ctr"><a:solidFill><a:schemeClr val="phClr"/></a:solidFill><a:prstDash val="solid"/><a:miter lim="800000"/></a:ln><a:ln w="19050" cap="flat" cmpd="sng" algn="ctr"><a:solidFill><a:schemeClr val="phClr"/></a:solidFill><a:prstDash val="solid"/><a:miter lim="800000"/></a:ln></a:lnStyleLst><a:effectStyleLst><a:effectStyle><a:effectLst/></a:effectStyle><a:effectStyle><a:effectLst/></a:effectStyle><a:effectStyle><a:effectLst><a:outerShdw blurRad="57150" dist="19050" dir="5400000" algn="ctr" rotWithShape="0"><a:srgbClr val="000000"><a:alpha val="63000"/></a:srgbClr></a:outerShdw></a:effectLst></a:effectStyle></a:effectStyleLst><a:bgFillStyleLst><a:solidFill><a:schemeClr val="phClr"/></a:solidFill><a:solidFill><a:schemeClr val="phClr"><a:tint val="95000"/><a:satMod val="170000"/></a:schemeClr></a:solidFill><a:gradFill rotWithShape="1"><a:gsLst><a:gs pos="0"><a:schemeClr val="phClr"><a:tint val="93000"/><a:satMod val="150000"/><a:shade val="98000"/><a:lumMod val="102000"/></a:schemeClr></a:gs><a:gs pos="50000"><a:schemeClr val="phClr"><a:tint val="98000"/><a:satMod val="130000"/><a:shade val="90000"/><a:lumMod val="103000"/></a:schemeClr></a:gs><a:gs pos="100000"><a:schemeClr val="phClr"><a:shade val="63000"/><a:satMod val="120000"/></a:schemeClr></a:gs></a:gsLst><a:lin ang="5400000" scaled="0"/></a:gradFill></a:bgFillStyleLst></a:fmtScheme></a:themeElements><a:objectDefaults/><a:extraClrSchemeLst/><a:extLst><a:ext uri="{05A4C25C-085E-4340-85A3-A5531E510DB2}"><thm15:themeFamily xmlns:thm15="http://schemas.microsoft.com/office/thememl/2012/main" name="Office Theme" id="{62F939B6-93AF-4DB8-9C6B-D6C7DFDC589F}" vid="{4A3C46E8-61CC-4603-A589-7422A47A8E4A}"/></a:ext></a:extLst></a:theme>`;
}
function makeXmlPresentation(pres) {
  let strXml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>${CRLF}<p:presentation xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships" xmlns:p="http://schemas.openxmlformats.org/presentationml/2006/main" ${pres.rtlMode ? 'rtl="1"' : ""} saveSubsetFonts="1" autoCompressPictures="0">`;
  strXml += '<p:sldMasterIdLst><p:sldMasterId id="2147483648" r:id="rId1"/></p:sldMasterIdLst>';
  strXml += "<p:sldIdLst>";
  pres.slides.forEach((slide) => strXml += `<p:sldId id="${slide._slideId}" r:id="rId${slide._rId}"/>`);
  strXml += "</p:sldIdLst>";
  strXml += `<p:notesMasterIdLst><p:notesMasterId r:id="rId${pres.slides.length + 2}"/></p:notesMasterIdLst>`;
  strXml += `<p:sldSz cx="${pres.presLayout.width}" cy="${pres.presLayout.height}"/>`;
  strXml += `<p:notesSz cx="${pres.presLayout.height}" cy="${pres.presLayout.width}"/>`;
  strXml += "<p:defaultTextStyle>";
  for (let idy = 1; idy < 10; idy++) {
    strXml += `<a:lvl${idy}pPr marL="${(idy - 1) * 457200}" algn="l" defTabSz="914400" rtl="0" eaLnBrk="1" latinLnBrk="0" hangingPunct="1"><a:defRPr sz="1800" kern="1200"><a:solidFill><a:schemeClr val="tx1"/></a:solidFill><a:latin typeface="+mn-lt"/><a:ea typeface="+mn-ea"/><a:cs typeface="+mn-cs"/></a:defRPr></a:lvl${idy}pPr>`;
  }
  strXml += "</p:defaultTextStyle>";
  if (pres.sections && pres.sections.length > 0) {
    strXml += '<p:extLst><p:ext uri="{521415D9-36F7-43E2-AB2F-B90AF26B5E84}">';
    strXml += '<p14:sectionLst xmlns:p14="http://schemas.microsoft.com/office/powerpoint/2010/main">';
    pres.sections.forEach((sect) => {
      strXml += `<p14:section name="${encodeXmlEntities(sect.title)}" id="{${getUuid("xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx")}}"><p14:sldIdLst>`;
      sect._slides.forEach((slide) => strXml += `<p14:sldId id="${slide._slideId}"/>`);
      strXml += "</p14:sldIdLst></p14:section>";
    });
    strXml += "</p14:sectionLst></p:ext>";
    strXml += '<p:ext uri="{EFAFB233-063F-42B5-8137-9DF3F51BA10A}"><p15:sldGuideLst xmlns:p15="http://schemas.microsoft.com/office/powerpoint/2012/main"/></p:ext>';
    strXml += "</p:extLst>";
  }
  strXml += "</p:presentation>";
  return strXml;
}
function makeXmlPresProps() {
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>${CRLF}<p:presentationPr xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships" xmlns:p="http://schemas.openxmlformats.org/presentationml/2006/main"/>`;
}
function makeXmlTableStyles() {
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>${CRLF}<a:tblStyleLst xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main" def="{5C22544A-7EE6-4342-B048-85BDC9FD1C3A}"/>`;
}
function makeXmlViewProps() {
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>${CRLF}<p:viewPr xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships" xmlns:p="http://schemas.openxmlformats.org/presentationml/2006/main"><p:normalViewPr horzBarState="maximized"><p:restoredLeft sz="15611"/><p:restoredTop sz="94610"/></p:normalViewPr><p:slideViewPr><p:cSldViewPr snapToGrid="0" snapToObjects="1"><p:cViewPr varScale="1"><p:scale><a:sx n="136" d="100"/><a:sy n="136" d="100"/></p:scale><p:origin x="216" y="312"/></p:cViewPr><p:guideLst/></p:cSldViewPr></p:slideViewPr><p:notesTextViewPr><p:cViewPr><p:scale><a:sx n="1" d="1"/><a:sy n="1" d="1"/></p:scale><p:origin x="0" y="0"/></p:cViewPr></p:notesTextViewPr><p:gridSpacing cx="76200" cy="76200"/></p:viewPr>`;
}
var VERSION = "4.0.1";
var PptxGenJS = class {
  set layout(value) {
    const newLayout = this.LAYOUTS[value];
    if (newLayout) {
      this._layout = value;
      this._presLayout = newLayout;
    } else {
      throw new Error("UNKNOWN-LAYOUT");
    }
  }
  get layout() {
    return this._layout;
  }
  get version() {
    return this._version;
  }
  set author(value) {
    this._author = value;
  }
  get author() {
    return this._author;
  }
  set company(value) {
    this._company = value;
  }
  get company() {
    return this._company;
  }
  set revision(value) {
    this._revision = value;
  }
  get revision() {
    return this._revision;
  }
  set subject(value) {
    this._subject = value;
  }
  get subject() {
    return this._subject;
  }
  set theme(value) {
    this._theme = value;
  }
  get theme() {
    return this._theme;
  }
  set title(value) {
    this._title = value;
  }
  get title() {
    return this._title;
  }
  set rtlMode(value) {
    this._rtlMode = value;
  }
  get rtlMode() {
    return this._rtlMode;
  }
  get masterSlide() {
    return this._masterSlide;
  }
  get slides() {
    return this._slides;
  }
  get sections() {
    return this._sections;
  }
  get slideLayouts() {
    return this._slideLayouts;
  }
  get AlignH() {
    return this._alignH;
  }
  get AlignV() {
    return this._alignV;
  }
  get ChartType() {
    return this._chartType;
  }
  get OutputType() {
    return this._outputType;
  }
  get presLayout() {
    return this._presLayout;
  }
  get SchemeColor() {
    return this._schemeColor;
  }
  get ShapeType() {
    return this._shapeType;
  }
  get charts() {
    return this._charts;
  }
  get colors() {
    return this._colors;
  }
  get shapes() {
    return this._shapes;
  }
  constructor() {
    this._version = VERSION;
    this._alignH = AlignH;
    this._alignV = AlignV;
    this._chartType = ChartType;
    this._outputType = OutputType;
    this._schemeColor = SchemeColor;
    this._shapeType = ShapeType;
    this._charts = CHART_TYPE;
    this._colors = SCHEME_COLOR_NAMES;
    this._shapes = SHAPE_TYPE;
    this.addNewSlide = (options) => {
      const sectAlreadyInUse = this.sections.length > 0 && this.sections[this.sections.length - 1]._slides.filter((slide) => slide._slideNum === this.slides[this.slides.length - 1]._slideNum).length > 0;
      options.sectionTitle = sectAlreadyInUse ? this.sections[this.sections.length - 1].title : null;
      return this.addSlide(options);
    };
    this.getSlide = (slideNum) => this.slides.filter((slide) => slide._slideNum === slideNum)[0];
    this.setSlideNumber = (slideNum) => {
      this.masterSlide._slideNumberProps = slideNum;
      this.slideLayouts.filter((layout) => layout._name === DEF_PRES_LAYOUT_NAME)[0]._slideNumberProps = slideNum;
    };
    this.createChartMediaRels = (slide, zip, chartPromises) => {
      slide._relsChart.forEach((rel) => chartPromises.push(createExcelWorksheet(rel, zip)));
      slide._relsMedia.forEach((rel) => {
        if (rel.type !== "online" && rel.type !== "hyperlink") {
          let data = rel.data && typeof rel.data === "string" ? rel.data : "";
          if (!data.includes(",") && !data.includes(";"))
            data = "image/png;base64," + data;
          else if (!data.includes(","))
            data = "image/png;base64," + data;
          else if (!data.includes(";"))
            data = "image/png;" + data;
          zip.file(rel.Target.replace("..", "ppt"), data.split(",").pop(), { base64: true });
        }
      });
    };
    this.writeFileToBrowser = (exportName, blobContent) => __awaiter(this, void 0, void 0, function* () {
      const eleLink = document.createElement("a");
      eleLink.setAttribute("style", "display:none;");
      eleLink.dataset.interception = "off";
      document.body.appendChild(eleLink);
      if (window.URL.createObjectURL) {
        const url = window.URL.createObjectURL(new Blob([blobContent], { type: "application/vnd.openxmlformats-officedocument.presentationml.presentation" }));
        eleLink.href = url;
        eleLink.download = exportName;
        eleLink.click();
        setTimeout(() => {
          window.URL.revokeObjectURL(url);
          document.body.removeChild(eleLink);
        }, 100);
        return yield Promise.resolve(exportName);
      }
    });
    this.exportPresentation = (props) => __awaiter(this, void 0, void 0, function* () {
      const arrChartPromises = [];
      let arrMediaPromises = [];
      const zip = new import_jszip.default();
      this.slides.forEach((slide) => {
        arrMediaPromises = arrMediaPromises.concat(encodeSlideMediaRels(slide));
      });
      this.slideLayouts.forEach((layout) => {
        arrMediaPromises = arrMediaPromises.concat(encodeSlideMediaRels(layout));
      });
      arrMediaPromises = arrMediaPromises.concat(encodeSlideMediaRels(this.masterSlide));
      return yield Promise.all(arrMediaPromises).then(() => __awaiter(this, void 0, void 0, function* () {
        this.slides.forEach((slide) => {
          if (slide._slideLayout)
            addPlaceholdersToSlideLayouts(slide);
        });
        zip.folder("_rels");
        zip.folder("docProps");
        zip.folder("ppt").folder("_rels");
        zip.folder("ppt/charts").folder("_rels");
        zip.folder("ppt/embeddings");
        zip.folder("ppt/media");
        zip.folder("ppt/slideLayouts").folder("_rels");
        zip.folder("ppt/slideMasters").folder("_rels");
        zip.folder("ppt/slides").folder("_rels");
        zip.folder("ppt/theme");
        zip.folder("ppt/notesMasters").folder("_rels");
        zip.folder("ppt/notesSlides").folder("_rels");
        zip.file("[Content_Types].xml", makeXmlContTypes(this.slides, this.slideLayouts, this.masterSlide));
        zip.file("_rels/.rels", makeXmlRootRels());
        zip.file("docProps/app.xml", makeXmlApp(this.slides, this.company));
        zip.file("docProps/core.xml", makeXmlCore(this.title, this.subject, this.author, this.revision));
        zip.file("ppt/_rels/presentation.xml.rels", makeXmlPresentationRels(this.slides));
        zip.file("ppt/theme/theme1.xml", makeXmlTheme(this));
        zip.file("ppt/presentation.xml", makeXmlPresentation(this));
        zip.file("ppt/presProps.xml", makeXmlPresProps());
        zip.file("ppt/tableStyles.xml", makeXmlTableStyles());
        zip.file("ppt/viewProps.xml", makeXmlViewProps());
        this.slideLayouts.forEach((layout, idx) => {
          zip.file(`ppt/slideLayouts/slideLayout${idx + 1}.xml`, makeXmlLayout(layout));
          zip.file(`ppt/slideLayouts/_rels/slideLayout${idx + 1}.xml.rels`, makeXmlSlideLayoutRel(idx + 1, this.slideLayouts));
        });
        this.slides.forEach((slide, idx) => {
          zip.file(`ppt/slides/slide${idx + 1}.xml`, makeXmlSlide(slide));
          zip.file(`ppt/slides/_rels/slide${idx + 1}.xml.rels`, makeXmlSlideRel(this.slides, this.slideLayouts, idx + 1));
          zip.file(`ppt/notesSlides/notesSlide${idx + 1}.xml`, makeXmlNotesSlide(slide));
          zip.file(`ppt/notesSlides/_rels/notesSlide${idx + 1}.xml.rels`, makeXmlNotesSlideRel(idx + 1));
        });
        zip.file("ppt/slideMasters/slideMaster1.xml", makeXmlMaster(this.masterSlide, this.slideLayouts));
        zip.file("ppt/slideMasters/_rels/slideMaster1.xml.rels", makeXmlMasterRel(this.masterSlide, this.slideLayouts));
        zip.file("ppt/notesMasters/notesMaster1.xml", makeXmlNotesMaster());
        zip.file("ppt/notesMasters/_rels/notesMaster1.xml.rels", makeXmlNotesMasterRel());
        this.slideLayouts.forEach((layout) => {
          this.createChartMediaRels(layout, zip, arrChartPromises);
        });
        this.slides.forEach((slide) => {
          this.createChartMediaRels(slide, zip, arrChartPromises);
        });
        this.createChartMediaRels(this.masterSlide, zip, arrChartPromises);
        return yield Promise.all(arrChartPromises).then(() => __awaiter(this, void 0, void 0, function* () {
          if (props.outputType === "STREAM") {
            return yield zip.generateAsync({ type: "nodebuffer", compression: props.compression ? "DEFLATE" : "STORE" });
          } else if (props.outputType) {
            return yield zip.generateAsync({ type: props.outputType });
          } else {
            return yield zip.generateAsync({ type: "blob", compression: props.compression ? "DEFLATE" : "STORE" });
          }
        }));
      }));
    });
    const layout4x3 = { name: "screen4x3", width: 9144e3, height: 6858e3 };
    const layout16x9 = { name: "screen16x9", width: 9144e3, height: 5143500 };
    const layout16x10 = { name: "screen16x10", width: 9144e3, height: 5715e3 };
    const layoutWide = { name: "custom", width: 12192e3, height: 6858e3 };
    this.LAYOUTS = {
      LAYOUT_4x3: layout4x3,
      LAYOUT_16x9: layout16x9,
      LAYOUT_16x10: layout16x10,
      LAYOUT_WIDE: layoutWide
    };
    this._author = "PptxGenJS";
    this._company = "PptxGenJS";
    this._revision = "1";
    this._subject = "PptxGenJS Presentation";
    this._title = "PptxGenJS Presentation";
    this._presLayout = {
      name: this.LAYOUTS[DEF_PRES_LAYOUT].name,
      _sizeW: this.LAYOUTS[DEF_PRES_LAYOUT].width,
      _sizeH: this.LAYOUTS[DEF_PRES_LAYOUT].height,
      width: this.LAYOUTS[DEF_PRES_LAYOUT].width,
      height: this.LAYOUTS[DEF_PRES_LAYOUT].height
    };
    this._rtlMode = false;
    this._slideLayouts = [
      {
        _margin: DEF_SLIDE_MARGIN_IN,
        _name: DEF_PRES_LAYOUT_NAME,
        _presLayout: this._presLayout,
        _rels: [],
        _relsChart: [],
        _relsMedia: [],
        _slide: null,
        _slideNum: 1e3,
        _slideNumberProps: null,
        _slideObjects: []
      }
    ];
    this._slides = [];
    this._sections = [];
    this._masterSlide = {
      addChart: null,
      addImage: null,
      addMedia: null,
      addNotes: null,
      addShape: null,
      addTable: null,
      addText: null,
      //
      _name: null,
      _presLayout: this._presLayout,
      _rId: null,
      _rels: [],
      _relsChart: [],
      _relsMedia: [],
      _slideId: null,
      _slideLayout: null,
      _slideNum: null,
      _slideNumberProps: null,
      _slideObjects: []
    };
  }
  // EXPORT METHODS
  /**
   * Export the current Presentation to stream
   * @param {WriteBaseProps} props - output properties
   * @returns {Promise<string | ArrayBuffer | Blob | Buffer | Uint8Array>} file stream
   */
  stream(props) {
    return __awaiter(this, void 0, void 0, function* () {
      return yield this.exportPresentation({
        compression: props === null || props === void 0 ? void 0 : props.compression,
        outputType: "STREAM"
      });
    });
  }
  /**
   * Export the current Presentation as JSZip content with the selected type
   * @param {WriteProps} props output properties
   * @returns {Promise<string | ArrayBuffer | Blob | Buffer | Uint8Array>} file content in selected type
   */
  write(props) {
    return __awaiter(this, void 0, void 0, function* () {
      const propsOutpType = typeof props === "object" && (props === null || props === void 0 ? void 0 : props.outputType) ? props.outputType : props ? props : null;
      const propsCompress = typeof props === "object" && (props === null || props === void 0 ? void 0 : props.compression) ? props.compression : false;
      return yield this.exportPresentation({
        compression: propsCompress,
        outputType: propsOutpType
      });
    });
  }
  /**
   * Export the current Presentation.
   * Write the generated presentation to disk (Node) or trigger a download (browser).
   * @param {WriteFileProps} props - output file properties
   * @returns {Promise<string>} the presentation name
   */
  writeFile(props) {
    return __awaiter(this, void 0, void 0, function* () {
      var _a, _b;
      const isNode = typeof process !== "undefined" && !!((_a = process.versions) === null || _a === void 0 ? void 0 : _a.node) && ((_b = process.release) === null || _b === void 0 ? void 0 : _b.name) === "node";
      if (typeof props === "string") {
        console.warn("[WARNING] writeFile(string) is deprecated - pass { fileName } instead.");
        props = { fileName: props };
      }
      const { fileName: rawName = "Presentation.pptx", compression = false } = props;
      const fileName = rawName.toLowerCase().endsWith(".pptx") ? rawName : `${rawName}.pptx`;
      const outputType = isNode ? "nodebuffer" : null;
      const data = yield this.exportPresentation({ compression, outputType });
      if (isNode) {
        const { promises: fs } = yield Promise.resolve().then(() => __toESM(require_node_fs()));
        const { writeFile } = fs;
        yield writeFile(fileName, data);
        return fileName;
      }
      yield this.writeFileToBrowser(fileName, data);
      return fileName;
    });
  }
  // PRESENTATION METHODS
  /**
   * Add a new Section to Presentation
   * @param {ISectionProps} section - section properties
   * @example pptx.addSection({ title:'Charts' });
   */
  addSection(section) {
    if (!section)
      console.warn("addSection requires an argument");
    else if (!section.title)
      console.warn("addSection requires a title");
    const newSection = {
      _type: "user",
      _slides: [],
      title: section.title
    };
    if (section.order)
      this.sections.splice(section.order, 0, newSection);
    else
      this._sections.push(newSection);
  }
  /**
   * Add a new Slide to Presentation
   * @param {AddSlideProps} options - slide options
   * @returns {PresSlide} the new Slide
   */
  addSlide(options) {
    const masterSlideName = typeof options === "string" ? options : (options === null || options === void 0 ? void 0 : options.masterName) ? options.masterName : "";
    let slideLayout = {
      _name: this.LAYOUTS[DEF_PRES_LAYOUT].name,
      _presLayout: this.presLayout,
      _rels: [],
      _relsChart: [],
      _relsMedia: [],
      _slideNum: this.slides.length + 1
    };
    if (masterSlideName) {
      const tmpLayout = this.slideLayouts.filter((layout) => layout._name === masterSlideName)[0];
      if (tmpLayout)
        slideLayout = tmpLayout;
    }
    const newSlide = new Slide({
      addSlide: this.addNewSlide,
      getSlide: this.getSlide,
      presLayout: this.presLayout,
      setSlideNum: this.setSlideNumber,
      slideId: this.slides.length + 256,
      slideRId: this.slides.length + 2,
      slideNumber: this.slides.length + 1,
      slideLayout
    });
    this._slides.push(newSlide);
    if (options === null || options === void 0 ? void 0 : options.sectionTitle) {
      const sect = this.sections.filter((section) => section.title === options.sectionTitle)[0];
      if (!sect)
        console.warn(`addSlide: unable to find section with title: "${options.sectionTitle}"`);
      else
        sect._slides.push(newSlide);
    } else if (this.sections && this.sections.length > 0 && !(options === null || options === void 0 ? void 0 : options.sectionTitle)) {
      const lastSect = this._sections[this.sections.length - 1];
      if (lastSect._type === "default")
        lastSect._slides.push(newSlide);
      else {
        this._sections.push({
          title: `Default-${this.sections.filter((sect) => sect._type === "default").length + 1}`,
          _type: "default",
          _slides: [newSlide]
        });
      }
    }
    return newSlide;
  }
  /**
   * Create a custom Slide Layout in any size
   * @param {PresLayout} layout - layout properties
   * @example pptx.defineLayout({ name:'A3', width:16.5, height:11.7 });
   */
  defineLayout(layout) {
    if (!layout)
      console.warn("defineLayout requires `{name, width, height}`");
    else if (!layout.name)
      console.warn("defineLayout requires `name`");
    else if (!layout.width)
      console.warn("defineLayout requires `width`");
    else if (!layout.height)
      console.warn("defineLayout requires `height`");
    else if (typeof layout.height !== "number")
      console.warn("defineLayout `height` should be a number (inches)");
    else if (typeof layout.width !== "number")
      console.warn("defineLayout `width` should be a number (inches)");
    this.LAYOUTS[layout.name] = {
      name: layout.name,
      _sizeW: Math.round(Number(layout.width) * EMU),
      _sizeH: Math.round(Number(layout.height) * EMU),
      width: Math.round(Number(layout.width) * EMU),
      height: Math.round(Number(layout.height) * EMU)
    };
  }
  /**
   * Create a new slide master [layout] for the Presentation
   * @param {SlideMasterProps} props - layout properties
   */
  defineSlideMaster(props) {
    const propsClone = JSON.parse(JSON.stringify(props));
    if (!propsClone.title)
      throw new Error("defineSlideMaster() object argument requires a `title` value. (https://gitbrent.github.io/PptxGenJS/docs/masters.html)");
    const newLayout = {
      _margin: propsClone.margin || DEF_SLIDE_MARGIN_IN,
      _name: propsClone.title,
      _presLayout: this.presLayout,
      _rels: [],
      _relsChart: [],
      _relsMedia: [],
      _slide: null,
      _slideNum: 1e3 + this.slideLayouts.length + 1,
      _slideNumberProps: propsClone.slideNumber || null,
      _slideObjects: [],
      background: propsClone.background || null,
      bkgd: propsClone.bkgd || null
    };
    createSlideMaster(propsClone, newLayout);
    this.slideLayouts.push(newLayout);
    if (propsClone.background || propsClone.bkgd)
      addBackgroundDefinition(propsClone.background, newLayout);
    if (newLayout._slideNumberProps && !this.masterSlide._slideNumberProps)
      this.masterSlide._slideNumberProps = newLayout._slideNumberProps;
  }
  // HTML-TO-SLIDES METHODS
  /**
   * Reproduces an HTML table as a PowerPoint table - including column widths, style, etc. - creates 1 or more slides as needed
   * @param {string} eleId - table HTML element ID
   * @param {TableToSlidesProps} options - generation options
   */
  tableToSlides(eleId, options = {}) {
    genTableToSlides(this, eleId, options, (options === null || options === void 0 ? void 0 : options.masterSlideName) ? this.slideLayouts.filter((layout) => layout._name === options.masterSlideName)[0] : null);
  }
};

// scripts/pptxgen-loader-entry.mjs
var pptxgen_loader_entry_default = PptxGenJS;
export {
  PptxGenJS,
  pptxgen_loader_entry_default as default
};
/*! Bundled license information:

jszip/dist/jszip.min.js:
  (*!
  
  JSZip v3.10.1 - A JavaScript class for generating and reading zip files
  <http://stuartk.com/jszip>
  
  (c) 2009-2016 Stuart Knightley <stuart [at] stuartk.com>
  Dual licenced under the MIT license or GPLv3. See https://raw.github.com/Stuk/jszip/main/LICENSE.markdown.
  
  JSZip uses the library pako released under the MIT license :
  https://github.com/nodeca/pako/blob/main/LICENSE
  *)
*/
