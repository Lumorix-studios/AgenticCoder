#include "syntaxhighlither.h"

#include <QColor>
#include <QRegularExpression>


SyntaxHighlighter::SyntaxHighlighter(QTextDocument *parent)
    : QSyntaxHighlighter(parent)
{

    keywordFormat.setForeground(
        QColor("#569CD6")
        );


    stringFormat.setForeground(
        QColor("#CE9178")
        );


    commentFormat.setForeground(
        QColor("#6A9955")
        );


    numberFormat.setForeground(
        QColor("#B5CEA8")
        );


    keywords = {

    // Types
    "bool",
        "char",
        "char8_t",
        "char16_t",
        "char32_t",
        "double",
        "float",
        "int",
        "long",
        "short",
        "signed",
        "unsigned",
        "void",
        "wchar_t",
        "auto",

        // Classes
        "class",
        "struct",
        "union",
        "enum",
        "public",
        "private",
        "protected",
        "friend",
        "virtual",
        "override",
        "final",
        "this",

        // Control
        "if",
        "else",
        "switch",
        "case",
        "default",
        "for",
        "while",
        "do",
        "break",
        "continue",
        "return",
        "goto",

        // Memory
        "new",
        "delete",
        "sizeof",
        "alignof",
        "nullptr",

        // Exceptions
        "try",
        "catch",
        "throw",
        "noexcept",

        // Templates
        "template",
        "typename",
        "concept",
        "requires",

        // Modifiers
        "const",
        "constexpr",
        "consteval",
        "constinit",
        "static",
        "extern",
        "inline",
        "mutable",
        "volatile",
        "thread_local",

        // Casts
        "static_cast",
        "dynamic_cast",
        "const_cast",
        "reinterpret_cast",

        // Namespace
        "namespace",
        "using",

        // Other
        "import",
        "module",
        "export",
        "asm",
        "decltype",
        "typeid",
        "alignas",

        // Values
        "true",
        "false"
};
}



void SyntaxHighlighter::highlightBlock(
    const QString &text
    )
{

    // Preprocessor (#include, #define, etc.)
    QRegularExpression preprocessor(
        "#\\s*[a-zA-Z_]+"
        );


    auto preMatches =
        preprocessor.globalMatch(text);


    while(preMatches.hasNext())
    {
        auto match = preMatches.next();

        setFormat(
            match.capturedStart(),
            match.capturedLength(),
            keywordFormat
            );
    }



    // Keywords
    for(const QString &word : keywords)
    {

        QRegularExpression regex(
            "\\b" +
            QRegularExpression::escape(word) +
            "\\b"
            );


        auto matches =
            regex.globalMatch(text);


        while(matches.hasNext())
        {
            auto match = matches.next();

            setFormat(
                match.capturedStart(),
                match.capturedLength(),
                keywordFormat
                );
        }
    }



    // Strings
    QRegularExpression strings(
        "\".*?\""
        );


    auto stringMatches =
        strings.globalMatch(text);


    while(stringMatches.hasNext())
    {
        auto match = stringMatches.next();

        setFormat(
            match.capturedStart(),
            match.capturedLength(),
            stringFormat
            );
    }



    // Single line comments
    QRegularExpression comments(
        "//.*"
        );


    auto commentMatches =
        comments.globalMatch(text);


    while(commentMatches.hasNext())
    {
        auto match = commentMatches.next();

        setFormat(
            match.capturedStart(),
            match.capturedLength(),
            commentFormat
            );
    }



    // Numbers
    QRegularExpression numbers(
        "\\b[0-9]+\\b"
        );


    auto numberMatches =
        numbers.globalMatch(text);


    while(numberMatches.hasNext())
    {
        auto match = numberMatches.next();

        setFormat(
            match.capturedStart(),
            match.capturedLength(),
            numberFormat
            );
    }
}