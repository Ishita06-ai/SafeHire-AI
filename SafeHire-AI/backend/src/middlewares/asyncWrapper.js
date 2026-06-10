/**
 * middlewares/asyncWrapper.js — Eliminates try-catch from every controller
 *
 * WHY THIS EXISTS:
 * Express doesn't natively catch async errors. If an async controller throws,
 * Express never receives the error and the request hangs forever.
 *
 * Without this wrapper, every async controller needs its own try-catch block.
 * That's repetitive boilerplate that adds noise and gets forgotten.
 *
 * HOW IT WORKS:
 * asyncWrapper is a Higher-Order Function (HOF) — a function that takes a
 * function and returns a new function. The returned function wraps the original
 * in a try-catch and passes any error to Express's next() — which routes it
 * to the global error handler.
 *
 * HIGHER-ORDER FUNCTION explained simply:
 * Like a protective bubble wrap around your controller.
 * If anything inside explodes, the bubble catches it — you don't have to.
 *
 * USAGE:
 *   router.get('/user/:id', asyncWrapper(async (req, res) => {
 *     const user = await userService.findById(req.params.id); // can throw freely
 *     return ApiResponse.ok(res, "User fetched", user);
 *   }));
 */

"use strict";

/**
 * @param {Function} fn - Any async Express route handler
 * @returns {Function}  - A new function that catches async errors and passes to next()
 */
const asyncWrapper = (fn) => {
  return (req, res, next) => {
    // Execute the async function
    // If it resolves → normal response
    // If it rejects → .catch(next) passes the error to Express error pipeline
    Promise.resolve(fn(req, res, next)).catch(next);
  };
};

module.exports = asyncWrapper;