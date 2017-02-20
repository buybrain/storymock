'use strict';

/**
 * This module can be used to easily create scriptable mock objects.
 */

const Promise = require('bluebird');
const _ = require('lodash');

/**
 * Create a new story mock helper
 */
module.exports = function () {
    // Map of allowed event types as keys, with optional argument matchers as values.
    const events = {};
    // The script steps as configured by the client.
    const story = [];
    // The currently playing story. Separate from `story` to allow for resets.
    let currentStory = null;

    /**
     * Make sure there is a current running story and return it
     */
    function getCurrentStory() {
        if (currentStory === null) {
            currentStory = _.clone(story);
        }
        return currentStory;
    }

    /**
     * Return the last event in the story
     */
    function lastEvent() {
        if (story.length === 0) {
            throw new Error('Cannot get last event of empty story');
        }
        return story[story.length - 1];
    }

    // The handle that will be returned to the mock implementer
    const play = {
        /**
         * Configure the mock with functions for client use
         */
        configure: subject => {
            /**
             * Add an assertion function that checks if the entire story played out
             */
            subject.assertStoryDone = () => {
                if (getCurrentStory().length > 0) {
                    throw new Error(
                        'Failed to assert story is done (remaining = ' + JSON.stringify(getCurrentStory()) + ')'
                    );
                }
            };

            /**
             * Add a step to the story
             */
            subject.expect = (event, arg) => {
                if (events[event] === undefined) {
                    throw new Error('Story mock event "' + event + '" is not defined');
                }
                const eventConf = events[event];
                // An argument is only allowed if there is an argument matcher defined for this event
                if (arg !== undefined && eventConf.matcher === null) {
                    throw new Error('Story mock event argument not allowed for event "' + event + '"');
                }
                const matcher = arg !== undefined ?
                    actual => eventConf.matcher(arg, actual):
                    () => true;
                story.push({event: event, arg: arg, matcher: matcher, success: true});
                return subject;
            };

            /**
             * Configure the last scripted event to succeed, optionally with a given result
             */
            subject.ok = result => {
                lastEvent().result = result;
                return subject;
            };

            /**
             * Configure the last scripted event to fail, optionally with a given error
             */
            subject.fail = err => {
                lastEvent().success = false;
                lastEvent().err = err;
                return subject;
            };

            /**
             * Reset the current story to allow reusing the mock
             */
            subject.reset = () => currentStory = null;

            return subject;
        }
    };

    /**
     * Register an allowed event type, optionally with a matcher to validate expected event data.
     * Will return synchronously when called.
     */
    play.event = (event, argumentMatcher) => {
        events[event] = {matcher: argumentMatcher || null, async: false};
        return play;
    };

    /**
     * Register an allowed event type, optionally with a matcher to validate expected event data.
     * Will return a promise when called.
     */
    play.asyncEvent = (event, argumentMatcher) => {
        events[event] = {matcher: argumentMatcher || null, async: true};
        return play;
    };

    /**
     * Get the outcome of the next story step, optionally with the given associated data.
     * Returns a promise that will either succeed or fail. This depends on whether the expected event happened as
     * expected, and on whether the step is scripted to succeed or fail.
     */
    play.outcomeOf = (event, data) => {
        // Check if this event exists at all
        if (events[event] === undefined) {
            throw new Error('Undefined event "' + event + '"');
        }
        const async = events[event].async;
        const remainingSteps = getCurrentStory().length;
        if (remainingSteps === 0) {
            return logAndReject('Got event of type "' + event + '", but story is empty', async);
        }
        const next = getCurrentStory().shift();
        if (next.event !== event) {
            return logAndReject(
                'Expected story event of type "' + next.event +
                '", but got "' + event +
                '" (remainingSteps = ' + remainingSteps + ')',
                async
            );
        }
        if (!next.matcher(data)) {
            return logAndReject(
                'Failed to assert that ' + JSON.stringify(data) +
                ' matched the next expected event data "' + next.arg +
                '" (remainingSteps = ' + remainingSteps + ')',
                async
            );
        }
        if (next.success) {
            return accept(next.result, async);
        } else {
            return reject(next.err || 'Unspecified error (story mock)');
        }
    };

    return play;
};

/**
 * Very common matcher pattern that checks for argument equality
 */
module.exports.equalsMatcher = _.isEqual;

/**
 * Accept with the given optional result. Returns resolved promise if async, returns result otherwise.
 */
function accept(result, async) {
    if (async) {
        return Promise.resolve(result);
    } else {
        return result;
    }
}

/**
 * Log the error and reject with the given error. Returns a rejected promise if async, throws otherwise.
 */
function logAndReject(err, async) {
    console.error(err);
    return reject(err, async);
}

/**
 * Reject with the given error. Returns a rejected promise if async, throws otherwise.
 */
function reject(err, async) {
    err = toErr(err);
    if (async) {
        return Promise.reject(err);
    } else {
        throw err;
    }
}

/**
 * Wrap the input in an Error object if it isn't already an Error object
 */
function toErr(err) {
    if (_.isError(err)) {
        return err;
    }
    return new Error(err);
}