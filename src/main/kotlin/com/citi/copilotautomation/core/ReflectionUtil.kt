package com.citi.copilotautomation.core

import com.intellij.openapi.diagnostic.Logger
import java.lang.reflect.Field
import java.util.concurrent.ConcurrentHashMap

/**
 * Consolidated reflection utilities for UI component interaction.
 * Centralizes all reflection-based operations with proper error handling and caching.
 */
object ReflectionUtil {
    private val LOG = Logger.getInstance(ReflectionUtil::class.java)

    // Cache for field lookups to avoid repeated reflection
    private val fieldCache = ConcurrentHashMap<Pair<Class<*>, String>, Field?>()

    /**
     * Safely invoke a no-arg method on an object.
     * @return The method result, or null if invocation failed
     */
    fun invokeMethod(target: Any, methodName: String): Any? {
        return try {
            val method = target.javaClass.getMethod(methodName)
            method.invoke(target)
        } catch (e: NoSuchMethodException) {
            LOG.debug("Method '$methodName' not found on ${target.javaClass.simpleName}")
            null
        } catch (e: Exception) {
            LOG.debug("Failed to invoke '$methodName' on ${target.javaClass.simpleName}: ${e.message}")
            null
        }
    }

    /**
     * Safely invoke a method with a single parameter.
     * @return The method result, or null if invocation failed
     */
    fun invokeMethod(target: Any, methodName: String, paramType: Class<*>, param: Any?): Any? {
        return try {
            val method = target.javaClass.getMethod(methodName, paramType)
            method.invoke(target, param)
        } catch (e: NoSuchMethodException) {
            LOG.debug("Method '$methodName($paramType)' not found on ${target.javaClass.simpleName}")
            null
        } catch (e: Exception) {
            LOG.debug("Failed to invoke '$methodName' on ${target.javaClass.simpleName}: ${e.message}")
            null
        }
    }

    /**
     * Get a field value from an object using reflection.
     * Uses caching for better performance on repeated access.
     * @return The field value, or null if not found or access failed
     */
    fun getFieldValue(target: Any, fieldName: String): Any? {
        val cacheKey = target.javaClass to fieldName
        val cachedField = fieldCache.computeIfAbsent(cacheKey) {
            try {
                target.javaClass.getDeclaredField(fieldName).apply { isAccessible = true }
            } catch (e: NoSuchFieldException) {
                LOG.debug("Field '$fieldName' not found on ${target.javaClass.simpleName}")
                null
            }
        }

        return try {
            cachedField?.get(target)
        } catch (e: Exception) {
            LOG.debug("Failed to get field '$fieldName' from ${target.javaClass.simpleName}: ${e.message}")
            null
        }
    }

    /**
     * Get a string field value from an object.
     * @return The string value, or null if not found or not a string
     */
    fun getStringField(target: Any, fieldName: String): String? {
        return getFieldValue(target, fieldName) as? String
    }

    /**
     * Try to get text from a component using various common methods.
     * Tries: getText(), text field, content field, markdown field
     * @return The extracted text, or null if none found
     */
    fun extractText(component: Any): String? {
        // Try getText() method first
        (invokeMethod(component, "getText") as? String)?.let {
            if (it.isNotBlank()) return cleanText(it)
        }

        // Try common field names
        for (fieldName in listOf("text", "content", "markdown")) {
            getStringField(component, fieldName)?.let {
                if (it.isNotBlank()) return cleanText(it)
            }
        }

        return null
    }

    /**
     * Clean text by stripping HTML tags if present.
     */
    private fun cleanText(text: String): String {
        if (!text.trimStart().startsWith("<")) {
            return text
        }
        // Strip HTML tags and decode common entities
        return text
            .replace(Regex("<[^>]*>"), "")
            .replace("&nbsp;", " ")
            .replace("&#8217;", "'")
            .replace("&amp;", "&")
            .replace("&lt;", "<")
            .replace("&gt;", ">")
            .replace("&quot;", "\"")
            .trim()
    }

    /**
     * Set text on a component using reflection.
     * @return true if successful, false otherwise
     */
    fun setText(target: Any, text: String): Boolean {
        return try {
            target.javaClass.getMethod("setText", String::class.java).invoke(target, text)
            true
        } catch (e: Exception) {
            LOG.debug("Failed to set text on ${target.javaClass.simpleName}: ${e.message}")
            false
        }
    }

    /**
     * Get item count from a combo box-like component.
     * @return The item count, or -1 if not available
     */
    fun getItemCount(comboBox: Any): Int {
        return (invokeMethod(comboBox, "getItemCount") as? Int) ?: -1
    }

    /**
     * Get item at index from a combo box-like component.
     * @return The item, or null if not available
     */
    fun getItemAt(comboBox: Any, index: Int): Any? {
        return invokeMethod(comboBox, "getItemAt", Int::class.java, index)
    }

    /**
     * Set selected index on a combo box-like component.
     * @return true if successful, false otherwise
     */
    fun setSelectedIndex(comboBox: Any, index: Int): Boolean {
        return try {
            comboBox.javaClass.getMethod("setSelectedIndex", Int::class.java).invoke(comboBox, index)
            true
        } catch (e: Exception) {
            LOG.debug("Failed to set selected index on ${comboBox.javaClass.simpleName}: ${e.message}")
            false
        }
    }

    /**
     * Invoke click() on a button-like component.
     * @return true if successful, false otherwise
     */
    fun click(button: Any): Boolean {
        return try {
            button.javaClass.getMethod("click").invoke(button)
            true
        } catch (e: Exception) {
            LOG.debug("Failed to click ${button.javaClass.simpleName}: ${e.message}")
            false
        }
    }

    /**
     * Clear the field cache. Useful for testing or when classes are reloaded.
     */
    fun clearCache() {
        fieldCache.clear()
    }
}
