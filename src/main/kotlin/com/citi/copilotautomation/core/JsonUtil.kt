package com.citi.copilotautomation.core

import com.fasterxml.jackson.databind.DeserializationFeature
import com.fasterxml.jackson.databind.ObjectMapper
import com.fasterxml.jackson.databind.SerializationFeature

/**
 * Centralized JSON utilities using Jackson ObjectMapper.
 * Provides pre-configured mappers for consistent JSON handling.
 */
object JsonUtil {

    /**
     * Standard ObjectMapper for general use (reading/writing).
     * Configured to ignore unknown properties during deserialization.
     */
    val mapper: ObjectMapper by lazy {
        ObjectMapper().apply {
            configure(DeserializationFeature.FAIL_ON_UNKNOWN_PROPERTIES, false)
        }
    }

    /**
     * Pretty-printing ObjectMapper for human-readable output.
     * Used for config files and debug output.
     */
    val prettyMapper: ObjectMapper by lazy {
        ObjectMapper().apply {
            enable(SerializationFeature.INDENT_OUTPUT)
            configure(DeserializationFeature.FAIL_ON_UNKNOWN_PROPERTIES, false)
        }
    }

    /**
     * Convert an object to JSON string.
     */
    fun toJson(obj: Any): String = mapper.writeValueAsString(obj)

    /**
     * Convert an object to pretty-printed JSON string.
     */
    fun toPrettyJson(obj: Any): String = prettyMapper.writeValueAsString(obj)

    /**
     * Parse JSON string to a map.
     */
    @Suppress("UNCHECKED_CAST")
    fun parseMap(json: String): Map<String, Any?> =
        mapper.readValue(json, Map::class.java) as Map<String, Any?>

    /**
     * Parse JSON string to specified type.
     */
    inline fun <reified T> parse(json: String): T =
        mapper.readValue(json, T::class.java)
}
