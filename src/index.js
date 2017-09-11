import Engine from './engine';
import Pipeline from './pipeline';
import Single from './single';
import Script from './script';
import Output from './output';
import Plugins from './plugins';
import Statement from './statement';

const ezs = (name, opts) => new Engine(ezs, Statement.get(ezs, name, opts), opts);

ezs.pipeline = (commands, options) => new Pipeline(ezs, commands, options);
ezs.all = (name, opts) => new Engine(ezs, Statement.get(ezs, name, opts), opts);
ezs.single = (mixed, options) => new Single(ezs, mixed, options);
ezs.script = (commands, options) => new Pipeline(ezs, Script(commands), options);
ezs.with = (selector, name, opts) => new Engine(ezs, Statement.get(ezs, name), opts, selector);
ezs.toBuffer = opts => new Output(opts);
ezs.use = plugin => Statement.set(ezs, plugin);
ezs.command = (stream, command) => {
    const mode = command.mode || 'all';
    if (!command.name) {
        throw new Error(`Bad command : ${command.name}`);
    }
    if (mode === 'all') {
        return stream.pipe(ezs.all(command.name, command.args));
    }
    if (mode === 'with') {
        return stream.pipe(ezs.with(command.test, command.name, command.args));
    }
    if (mode === 'single') {
        return stream.pipe(ezs.single(command.name, command.args));
    }
    throw new Error(`Bad mode: ${mode}`);
};

ezs.use(Plugins);

module.exports = ezs;

