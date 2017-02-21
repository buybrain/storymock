'use strict';

const storymock = require('../lib/storymock');

exports.testSyncCalculatorMock = function (t) {
    // Part one: create the calculator mock that supports numbers, addition and getting the result.
    // Note that it doesn't actually do any calculations, but allows the client to script the desired results.
    const mock = storymock()
        .event('set', storymock.equalsMatcher)
        .event('add', storymock.equalsMatcher)
        .event('gives');

    const calc = mock.configure({
        num: input => mock.outcomeOf('set', input),
        plus: extra => mock.outcomeOf('add', extra),
        gives: () => mock.outcomeOf('gives')
    });

    // Create a story of expected calculator inputs and outputs
    calc
        .expect('set', 3).ok(calc)
        .expect('add', 2).ok(calc)
        .expect('gives').ok(5);

    // Now actually use it and assert the correct behaviour
    t.equal(calc.num(3).plus(2).gives(), 5);
    calc.assertStoryDone();
    t.done();
};

exports.testAsyncCalculatorMock = function (t) {
    // Part one: create the calculator mock that supports numbers, addition and getting the result.
    // Note that it doesn't actually do any calculations, but allows the client to script the desired results.
    const mock = storymock()
        .asyncEvent('set', storymock.equalsMatcher)
        .asyncEvent('add', storymock.equalsMatcher)
        .asyncEvent('gives');

    const calc = mock.configure({
        num: input => mock.outcomeOf('set', input),
        plus: extra => mock.outcomeOf('add', extra),
        gives: () => mock.outcomeOf('gives')
    });

    // Create a story of expected calculator inputs and outputs
    calc
        .expect('set', 3)
        .expect('add', 2)
        .expect('gives').ok(5);

    // Now actually use it and assert the correct behaviour
    calc.num(3)
        .then(() => calc.plus(2))
        .then(() => calc.gives())
        .then(result => {
            t.equal(result, 5);
            calc.assertStoryDone();
            t.done();
        });
};

exports.testUnexpectedEvent = function (t) {
    const mock = storymock().event('a').event('b');

    const impl = mock.configure({
        a: () => mock.outcomeOf('a'),
        b: () => mock.outcomeOf('b')
    });

    impl.expect('a');

    try {
        impl.b();
    } catch (err) {
        t.equal('Expected story event of type "a", but got "b" (remainingSteps = 1)', err.message);
        t.done();
    }
};

exports.testUnexpectedEventAsync = function (t) {
    const mock = storymock().asyncEvent('a').asyncEvent('b');

    const impl = mock.configure({
        a: () => mock.outcomeOf('a'),
        b: () => mock.outcomeOf('b')
    });

    impl.expect('a');

    impl.b().catch(err => {
        t.equal('Expected story event of type "a", but got "b" (remainingSteps = 1)', err.message);
        t.done();
    });
};

exports.testFailingMatcher = function (t) {
    const mock = storymock().event('a', storymock.equalsMatcher);

    const impl = mock.configure({
        a: val => mock.outcomeOf('a', val)
    });

    impl.expect('a', 42);

    try {
        impl.a(43);
    } catch (err) {
        t.equal(
            'Failed to assert that 43 matched the next expected event data 42 (remainingSteps = 1)',
            err.message
        );
        t.done();
    }
};

exports.testScriptedResult = function (t) {
    const mock = storymock().event('a');

    const impl = mock.configure({
        a: () => mock.outcomeOf('a')
    });

    impl.expect('a').ok(42);

    t.equal(42, impl.a());
    t.done();
};

exports.testScriptedError = function (t) {
    const mock = storymock().event('a');

    const impl = mock.configure({
        a: () => mock.outcomeOf('a')
    });

    impl.expect('a').fail('oh no');

    try {
        impl.a();
    } catch (err) {
        t.equal('oh no', err.message);
        t.done();
    }
};

exports.testComplexEqualsMatcher = function (t) {
    const mock = storymock().event('a', storymock.equalsMatcher);

    const impl = mock.configure({
        a: val => mock.outcomeOf('a', val)
    });

    impl.expect('a', [12, [34, new Buffer('wow')]]);

    impl.a([12, [34, new Buffer('wow')]]);
    t.done();
};