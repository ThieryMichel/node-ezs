import _ from 'lodash';
import util from 'util';

function assign(data, feed) {
    if (this.isLast()) {
        return feed.send(data);
    }
    const test = this.getParam('test', true);
    if (!test) {
        return feed.send(data);
    }
    let keys = this.getParam('path', []);
    let values = this.getParam('value', []);
    if (!Array.isArray(keys)) {
        keys = [keys];
    }
    if (!Array.isArray(values)) {
        values = [values];
    }
    keys = keys.filter(k => typeof k === 'string');
    values = _.take(values, keys.length);
    const assets = _.zipObject(keys, values);

    Object.keys(assets).forEach((key) => {
        _.set(data, key, assets[key]);
    });
    return feed.send(data);
}

function replace(data, feed) {
    if (this.isLast()) {
        return feed.send(data);
    }
    const test = this.getParam('test', true);
    if (!test) {
        return feed.send(data);
    }
    let keys = this.getParam('path', []);
    let values = this.getParam('value', []);
    if (!Array.isArray(keys)) {
        keys = [keys];
    }
    if (!Array.isArray(values)) {
        values = [values];
    }
    keys = keys.filter(k => typeof k === 'string');
    values = _.take(values, keys.length);
    const assets = _.zipObject(keys, values);
    const obj = {};
    Object.keys(assets).forEach((key) => {
        _.set(obj, key, assets[key]);
    });
    return feed.send(obj);
}

function debug(data, feed) {
    if (this.isLast()) {
        return feed.send(data);
    }
    const level = this.getParam('level', 'log');
    const text = this.getParam('text', 'valueOf');
    if (typeof console[level] === 'function') {
        const logOpts = { showHidden: false, depth: 3, colors: true };
        const logFunc = console[level];
        logFunc(text.concat('#').concat(this.getIndex()).concat(' ->'), util.inspect(data, logOpts));
    }
    return feed.send(data);
}

function shift(data, feed) {
    feed.write(data);
    feed.close();
}

function extract(data, feed) {
    if (this.isLast()) {
        return feed.send(data);
    }
    let keys = this.getParam('path', []);
    if (!Array.isArray(keys)) {
        keys = [keys];
    }

    keys = keys.filter(k => typeof k === 'string');
    const values = keys.map(key => _.get(data, key)).filter(val => val);

    if (values.length === 0) {
        return feed.send(undefined);
    } else if (values.length === 1) {
        return feed.send(values[0]);
    }
    return feed.send(values);
}

export default {
    assign,
    replace,
    shift,
    extract,
    debug,
};
