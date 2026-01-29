package com.citi.copilotautomation.core

import com.intellij.openapi.diagnostic.Logger
import java.awt.Component
import java.awt.Container

// Note: ReflectionUtil is in the same package, no import needed

/**
 * Unified component tree traversal utility.
 * Replaces duplicated traversal logic across multiple files.
 */
object ComponentFinder {
    private val LOG = Logger.getInstance(ComponentFinder::class.java)

    /**
     * Find all components matching a class name.
     * @param root The root component to search from
     * @param className Fully qualified class name to match
     * @param stopOnFirst If true, stops after finding the first match
     * @return List of matching components
     */
    fun findByClassName(
        root: Component?,
        className: String,
        stopOnFirst: Boolean = false
    ): List<Component> {
        if (root == null) return emptyList()

        val result = mutableListOf<Component>()
        traverse(root, stopOnFirst) { component ->
            if (component.javaClass.name == className) {
                result.add(component)
                true // matched
            } else {
                false // not matched
            }
        }
        return result
    }

    /**
     * Find the first component matching a class name.
     * More efficient than findByClassName when only one match is needed.
     */
    fun findFirstByClassName(root: Component?, className: String): Component? {
        return findByClassName(root, className, stopOnFirst = true).firstOrNull()
    }

    /**
     * Find all components matching a predicate.
     * @param root The root component to search from
     * @param stopOnFirst If true, stops after finding the first match
     * @param predicate Function that returns true for matching components
     * @return List of matching components
     */
    fun findByPredicate(
        root: Component?,
        stopOnFirst: Boolean = false,
        predicate: (Component) -> Boolean
    ): List<Component> {
        if (root == null) return emptyList()

        val result = mutableListOf<Component>()
        traverse(root, stopOnFirst) { component ->
            if (predicate(component)) {
                result.add(component)
                true
            } else {
                false
            }
        }
        return result
    }

    /**
     * Find the first component matching a predicate.
     */
    fun findFirstByPredicate(root: Component?, predicate: (Component) -> Boolean): Component? {
        return findByPredicate(root, stopOnFirst = true, predicate).firstOrNull()
    }

    /**
     * Find all components of a specific type.
     */
    inline fun <reified T : Component> findByType(root: Component?, stopOnFirst: Boolean = false): List<T> {
        return findByPredicate(root, stopOnFirst) { it is T }.filterIsInstance<T>()
    }

    /**
     * Find the first component of a specific type.
     */
    inline fun <reified T : Component> findFirstByType(root: Component?): T? {
        return findByType<T>(root, stopOnFirst = true).firstOrNull()
    }

    /**
     * Collect all unique class names in the component tree.
     * Useful for diagnostics and debugging.
     * @param filterPrefix Optional prefix to filter class names (e.g., "com.github.copilot")
     */
    fun collectClassNames(root: Component?, filterPrefix: String? = null): Map<String, Int> {
        if (root == null) return emptyMap()

        val counts = mutableMapOf<String, Int>()
        traverse(root, stopOnFirst = false) { component ->
            val className = component.javaClass.name
            if (filterPrefix == null || className.startsWith(filterPrefix)) {
                counts[className] = (counts[className] ?: 0) + 1
            }
            false // continue traversal
        }
        return counts.toSortedMap()
    }

    /**
     * Count visible components matching a class name and action type.
     * Used for detecting Stop buttons during generation.
     */
    fun countVisibleWithAction(
        root: Component?,
        buttonClassName: String,
        actionClassName: String
    ): Int {
        if (root == null) return 0

        var count = 0
        val buttons = findByClassName(root, buttonClassName)

        for (button in buttons) {
            val action = ReflectionUtil.invokeMethod(button, "getAction")
            if (action != null && action.javaClass.name == actionClassName && button.isShowing) {
                count++
            }
        }

        return count
    }

    /**
     * Find a button with a specific action class.
     */
    fun findButtonWithAction(
        root: Component?,
        buttonClassName: String,
        actionClassName: String,
        mustBeVisible: Boolean = true
    ): Component? {
        if (root == null) return null

        val buttons = findByClassName(root, buttonClassName)
        for (button in buttons) {
            val action = ReflectionUtil.invokeMethod(button, "getAction")
            if (action != null && action.javaClass.name == actionClassName) {
                if (!mustBeVisible || button.isShowing) {
                    return button
                }
            }
        }

        return null
    }

    /**
     * Core traversal function.
     * @param root Component to start from
     * @param stopOnFirst Stop after first match
     * @param visitor Function called for each component, returns true if matched
     * @return true if should stop (match found and stopOnFirst is true)
     */
    private fun traverse(
        root: Component,
        stopOnFirst: Boolean,
        visitor: (Component) -> Boolean
    ): Boolean {
        if (visitor(root) && stopOnFirst) {
            return true
        }

        if (root is Container) {
            for (child in root.components) {
                if (traverse(child, stopOnFirst, visitor)) {
                    return true
                }
            }
        }

        return false
    }
}
