// https://github.com/zfrenchee/Axial#readme v0.0.2 Copyright 2018 Alex LeNail
(function (global, factory) {
typeof exports === 'object' && typeof module !== 'undefined' ? factory(exports, require('js')) :
typeof define === 'function' && define.amd ? define(['exports', 'js'], factory) :
(factory((global.axial = global.axial || {}),global.js));
}(this, (function (exports,js) { 'use strict';

Object.keys(js).forEach(function (key) { exports[key] = js[key]; });

Object.defineProperty(exports, '__esModule', { value: true });

})));
