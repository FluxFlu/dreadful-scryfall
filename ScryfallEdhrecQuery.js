const fs = require("fs");

const getLegalCards = async () => {
    const response = await fetch('https://data.scryfall.io/default-cards/default-cards-20231009210724.json');
    const cardList = await response.json();
    const edhLegalCards = cardList.filter(card => card.legalities.commander == 'legal').filter(e => e.reprint == false && e.digital == false)//.sort((a, b) => date_to_int(a.released_at) - date_to_int(b.released_at));
    const edhLegalCardNames = edhLegalCards.map(e => e.name);
    const finalList = edhLegalCards.filter((card, i) => edhLegalCardNames.indexOf(card.name) == i)
    return finalList.filter(e => e.edhrec_rank >= 5000).sort((a, b) => a.edhrec_rank - b.edhrec_rank);
}

getLegalCards().then(async (cardList) => {
    let str = "<!DOCTYPE html><html><body>";
    str += `
    <style>
        body {
            background-color: #444;
            z-index: -2;
        }
        #background {
            position: fixed;
            left: 10vw;
            top: 0;
            width: 80vw;
            height: 100%;
            background-color: #aaa;
            z-index: -1;
        }
        #fullPage {
            margin-left: 15vw;
            width: 70vw;
            height: 100vh;
        }
        input {
            margin-bottom: 4%;
            margin-top: 4%;
            width: 70%;
            height: 5vh;
            margin-left: 3.75%;
            font-size: 3vh;
            background-color: #777;
            color: #f6f6f6;
            border: none;
        }
        button {
            width: 10%;
            height: 6vh;
            font-size: 2.7vh;
            background-color: #e6e6e6;
            color: #666;
            border: 1vh solid block;
        }
        img {
            position: absolute;
            width: 15vw;
            height: calc(7 / 5 * 15vw);
            border-radius: 4.75% / 3.5%;
            filter: drop-shadow(0 0 0.35rem #3339);
        }
    </style>
    <div id="background"></div>
    <div id="fullPage">
    <input type="text" id="searchBar" placeholder="Search for cards..">
    <button class="previous">&lt; Previous</button>
    <button class="next">&gt; Next 60</button>
    <script>
    window.onload = function() {
    
        const cardList = JSON.parse("${JSON.stringify(cardList).replaceAll("\\", "\\\\").replaceAll('"', '\\"')}");
        let currentPage = 0;
            
        let card_count = 0;

        const imgDiv = document.getElementById("imgList");
        const imgList = imgDiv.getElementsByTagName("img");

        function pageLeft() {
            if (currentPage)
                currentPage--;
            search({key: "Enter", preventDefault: () => {}}, true)
        }

        function pageRight() {
            if ((currentPage + 1) * 60 < card_count)
                currentPage++;
            search({key: "Enter", preventDefault: () => {}}, true)
        }

        Array.from(document.getElementsByClassName("previous")).forEach(button => button.onclick = pageLeft);
        Array.from(document.getElementsByClassName("next")).forEach(button => button.onclick = pageRight);

        function parseInput(input) {
            input = input.toLowerCase();
            let splitInput = [];
            let currentString = '';
            let is_literal = false;
            for (let i = 0; i < input.length; i++) {
                if (input[i] == '"') {
                    is_literal = !is_literal;
                    continue;
                }
                if (input[i] == ' ' && !is_literal) {
                    splitInput.push(currentString);
                    currentString = '';
                    continue;
                }

                currentString += input[i];
            }
            splitInput.push(currentString);
            const operatorList = [
                ':', '=',
                '>', '<', '>=', '<=',
            ]
            const inputList = splitInput.filter(e => e).map(requirement => {
                if (operatorList.filter(operator => requirement.includes(operator)).length == 0)
                    return {
                        key: "name",
                        value: requirement,
                        operator: ':'
                    }
                for (let i = 0; i < operatorList.length; i++) {
                    const operator = operatorList[i];
                    if (!requirement.includes(operator)) continue;
                    const split = requirement.split(operator);
                    return {
                        key: split[0],
                        value: split[1],
                        operator
                    }
                }
            });
            inputList.forEach(input => {
                if (shorthand[input.key])
                    input.key = shorthand[input.key];
            })
            return inputList;
        }

        function sortCards(cardList, order) {
            switch (order) {
                case "edhrec":
                default:
                    return cardList;
            }
        }
        
        const shorthand = {
            n: "name",
            o: "oracle_text",
            oracle: "oracle_text",
            mv: "cmc",
            pow: "power",
            tou: "toughness",
            c: "colors",
            color: "colors",
            id: "ids",
            t: "type_line",
            type: "type_line"
        }

        function parseMana(str) {
            const manaArray = [];
            let currentMana = '';
            let is_literal = 0;
            for (let i = 0; i < str.length; i++) {
                if (str[i] == '{') {
                    is_literal++;
                    continue;
                }
                if (str[i] == '}') {
                    is_literal--;
                    if (!is_literal) {
                        manaArray.push(currentMana);
                        currentMana = "";
                    }
                    continue;
                }
                if (is_literal) {
                    currentMana += str[i];
                }
                else
                    manaArray.push(str[i]);
            }
            manaArray.push(currentMana);
            return manaArray;
        }

        function cleanup(card, value, key) {
            value = value.replaceAll('~', card.name);
            if (!card[key] && card.card_faces)
                card = card.card_faces[0];
            if (!card[key])
                return [ !value, "RETURN" ];
            if (typeof card[key] == "string")
                card[key] = card[key].toLowerCase();
            if (typeof value == "string")
                value = value.toLowerCase();
            return [ card, value ]
        }

        function colorHandler (card, value, key, operator) {
            if (!card[key] && card.card_faces)
                card[key] = card.card_faces[0].color;
            if (!card[key])
                return !value || value == "0";
            if (+value == value) {
                value = +value;
                switch (operator) {
                    case ":":
                    case "=":
                        return card[key].length == value;
                    case ">":
                        return card[key].length > value;
                    case "<":
                        return card[key].length < value;
                    case ">=":
                        return card[key].length >= value;
                    case "<=":
                        return card[key].length <= value;
                }
            }
            if ([ "white", "blue", "black", "red", "green", "colorless" ].includes(value))
                value = value[0];
            value = value.toLowerCase().split('').filter(e => e != 'c');
            card[key] = card[key].map(e => e.toLowerCase());

            switch(operator) {
                case '>=':
                case ':':
                    return value.filter(color => card[key].includes(color)).length == value.length;
                case '=':
                    return value.length == card[key].length && !value.filter((e, i) => e != card[key][i]).length
                case '>':
                    return value.filter(color => card[key].includes(color)).length == value.length && card[key].length > value.length
                case '<':
                    return card[key].filter(color => value.includes(color)).length == card[key].length && card[key].length < value.length
                case '<=':
                    return card[key].filter(color => value.includes(color)).length == card[key].length
            }
        }

        const isFunctions = {
            "commander": card => {
                const type_line = card.type_line.split('//')[0].trim();
                return type_line.toLowerCase().includes("legendary") && type_line.toLowerCase().includes("creature") || (card.oracle_text || card.card_faces && card.card_faces[0].oracle_text || "").toLowerCase().includes(card.name + " can be your commander.");
            }
        }

        const handleRequirementsOverride = {
            is: (card, value, operator) => {
                return isFunctions[value](card);
            },
            mana: (card, value, operator) => {
                [ card, value ] = cleanup(card, value, "mana_cost");
                
                if (value === "RETURN") return card;
                
                const cardMana = parseMana(card.mana_cost);
                value = parseMana(value);
                if (cardMana.filter((e, i) => value[i] != e).length)
                    return false;
                return true;
            },
            colors: (card, value, operator) => {
                return colorHandler(card, value, "colors", operator);
            },
            ids: (card, value, operator) => {
                return colorHandler(card, value, "color_identity", operator);
            },
        }

        function handleRequirements(card, value, key, operator) {
            if (handleRequirementsOverride[key])
                return handleRequirementsOverride[key](card, value, operator);
            [ card, value ] = cleanup(card, value, key);
            if (value === "RETURN") return card;
            if (operator == ':')
                return card[key].includes(value);
            if (operator == '=')
                return card[key] == value;
            if (operator == '>')
                return +card[key] > +value;
            if (operator == '<')
                return +card[key] < +value;
            if (operator == '>=')
                return +card[key] >= +value;
            if (operator == '<=')
                return +card[key] <= +value;
        }
        
        function search(e, fake) {
            if (!fake)
                currentPage = 0;
            if (e.key != "Enter") return;
            e.preventDefault();

            if (document.getElementById("searchBar").value.replaceAll(/\\s/g, '') == '') return;

            const input = parseInput(document.getElementById("searchBar").value);

            console.log(input)

            const sortedList = sortCards(cardList, input.order);
            
            card_count = 0;

            for (let i = 0; i < sortedList.length; i++) {
                const card = sortedList[i];
                let passes_tests = true;
                for (let j = 0; j < input.length; j++) {
                    const requirement = input[j];
                    if (!handleRequirements(card, requirement.value, requirement.key, requirement.operator)) {
                        passes_tests = false;
                        break;
                    }
                }
                const card_index = card_count - currentPage * 60;
                if (card_index < 0 || card_index >= 60) {
                    if (passes_tests)
                        card_count++;
                    const cardImage = document.getElementById(card.oracle_id);
                    if (!cardImage) continue;
                    cardImage.style.display = "none";
                    continue;
                }
                if (passes_tests) {
                    card_count++;
                    let cardImage = document.getElementById(card.oracle_id);
                    let img = document.getElementById("img_" + card.oracle_id);
                    if (!cardImage) {
                        cardImage = document.createElement("a");
                        img = new Image();
                        if (!card.image_uris)
                            img.src = card.card_faces[0].image_uris.normal;
                        else
                            img.src = card.image_uris.normal;
                        console.log(card, card_index);
                        cardImage.href = card.scryfall_uri;
                        cardImage.id = card.oracle_id;
                        img.id = "img_" + card.oracle_id;
                        cardImage.appendChild(img);
                        imgDiv.appendChild(cardImage);
                    }
                    img.style.top = "calc(7 / 5 * " + Math.floor(card_index / 4) + " * 33.5vh + 20.5vh)";
                    img.style.left = "calc(" + (card_index % 4) + " * 15.5vw + 19.2vw)";
                    cardImage.style.display = "block";
                } else {
                    const cardImage = document.getElementById(card.oracle_id);
                    if (!cardImage) continue;
                    cardImage.style.display = "none";
                }
            }
        }

        document.getElementById("searchBar").onkeyup = search;
    }

    </script>
    
    <div id="imgList">
    `
    str += `</div></div></body></html>`
    fs.writeFileSync("elderDreadfulCardSearch.html", str);
});