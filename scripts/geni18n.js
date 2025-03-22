const { recursiveFindAll } = require("./common");
const fs = require("fs");
const readline = require('readline');

var rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
    terminal: false
});

const strRegex = "('(?:\\\\\\\\|\\\\.|[^\\\\'])*'|\"(?:\\\\\\\\|\\\\.|[^\\\\\"])*\")";

function unescapeString(str) {
    const quote = str[0];
    return str.substr(1, str.length - 2)
        .replace(new RegExp("\\\\" + quote, "g"), quote)
        .replace(/\\n/g, '\n')
        .replace(/\\t/g, '\t')
        .replace(/\\r/g, '\r')
        .replace(/\\\\/g, '\\')
        ;
}

async function findLocalizeInside(file, localize, type) {
    const content = (await fs.promises.readFile(file)).toString();
    const regex = type !== 'html' ? new RegExp("(?<!\\w)(" + localize + "\\s*\\()" + strRegex + "\\s*,\\s*" + strRegex + "\\s*[,)]", "g") :
        /(%)(.*?)(?:\|(.*?))?%/g;

    const result = [];
    let match;
    while (match = regex.exec(content)) {
        const keyIndex = match.index + match[1].length;

        if (type !== 'html') {
            result.push([unescapeString(match[2]), unescapeString(match[3]), file, keyIndex]);
        } else {
            result.push([match[2], match[3], file, keyIndex]);
        }
    }

    return result;
}

async function replaceInFile(file, matches) {
    matches.sort((a, b) => a[3] - b[3]);
    const content = (await fs.promises.readFile(file)).toString();
    let resultContent = "";
    let lastEnd = 0;

    matches.forEach(match => {
        resultContent += content.substring(lastEnd, match[3]);
        if (file.endsWith('.html')) {
            resultContent += match[0];
            lastEnd = match[3] + 4;
        } else {
            resultContent += "'";
            resultContent += match[0];
            resultContent += "'";
            lastEnd = match[3] + 6;
        }
    });

    resultContent += content.substr(lastEnd);

    await fs.promises.writeFile(file, resultContent);
}

async function generateEnLocalizationFile(file, resultStr) {
    const content = (await fs.promises.readFile(file)).toString('utf-8');
    const sotComment = '/* SOT Do not remove this comment */';
    const eotComment = ';/* EOT Do not remove this comment */';
    const sPos = content.indexOf(sotComment) + sotComment.length;
    const ePos = content.indexOf(eotComment);
    const str = content.substr(0, sPos) + resultStr + content.substr(ePos);
    await fs.promises.writeFile(file, str);
}

(async () => {
    const srcFiles = (await recursiveFindAll("./src")).filter(file => file.endsWith(".ts"));
    const localizedPairs = (await Promise.all(srcFiles.map(file => findLocalizeInside(file, 'localize')))).reduce((p, c) => p.concat(c), []);
    const srcHtmlFiles = (await recursiveFindAll("./src")).filter(file => file.endsWith(".html"));
    const localizedHtmlPairs = (await Promise.all(srcHtmlFiles.map(file => findLocalizeInside(file, 'localize', 'html')))).reduce((p, c) => p.concat(c), []);
    const webSrcFiles = (await recursiveFindAll("./webviewsrc")).filter(file => file.endsWith(".ts"));
    const webSrcLocalizedPairs = (await Promise.all(webSrcFiles.map(file => findLocalizeInside(file, 'feLocalize')))).reduce((p, c) => p.concat(c), []);

    const allPairs = [...localizedPairs, ...localizedHtmlPairs, ...webSrcLocalizedPairs];
    const groupedKeyValues = {};

    allPairs.forEach(pair => {
        const key = pair[0];
        const value = pair[1];
        let arr = groupedKeyValues[key];
        if (!arr) {
            arr = [];
            groupedKeyValues[key] = arr;
        }

        if (key === 'TODO') {
            arr.push(pair);
        } else {
            if (!arr.includes(value)) {
                arr.push(value);
            }
        }
    });

    const result = {};
    Object.entries(groupedKeyValues).forEach(entry => {
        if (entry[0] !== 'TODO') {
            if (entry[1].length > 1) {
                console.error(entry);
            }
            result[entry[0]] = entry[1][0];
        }
    });

    if (groupedKeyValues.TODO) {
        const resolvedTodoByFile = {};
        const valueToKey = {};
        for (let i = 0; i < groupedKeyValues.TODO.length; i++) {
            const value = groupedKeyValues.TODO[i];

            const key = value[1] in valueToKey ? valueToKey[value[1]] : await new Promise(resolve => {
                rl.question(value[1] + '> ', resolve);
            });

            if (key) {
                valueToKey[value[1]] = key;
                result[key] = value[1];

                const file = value[2];
                if (file in resolvedTodoByFile) {
                    resolvedTodoByFile[file].push([key, ...value.slice(1)]);
                } else {
                    resolvedTodoByFile[file] = [[key, ...value.slice(1)]];
                }
            }
        }

        await Promise.all(Object.entries(resolvedTodoByFile).map(pair => replaceInFile(pair[0], pair[1])));
    }

    const resultStr = JSON.stringify(result, Object.keys(result).sort(), 4);
    await generateEnLocalizationFile('./i18n/en.ts', resultStr);

    console.log(resultStr);

    rl.close();
})();
