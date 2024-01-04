const express = require('express');
const router = express.Router();
const axios = require('axios');
const aposToLexForm = require('apos-to-lex-form');
const natural = require('natural');
const SpellCorrector = require('spelling-corrector');
const SW = require('stopword');

const spellCorrector = new SpellCorrector();
spellCorrector.loadDictionary();

/* GET home page. */
router.get('/', function (req, res, next) {
    res.render('index', {title: 'Express'});
});

router.get('/sentiment', async (req, res) => {
        console.log('route sentiment...');

        try {
            const posts = [
                'https://api.reddit.com/r/formula1/comments/10r0w6a/announcement_welcome_to_the_2023_f1_season',
                'https://api.reddit.com/r/formula1/comments/11j1huz/2023_bahrain_grand_prix_post_race_discussion',
                'https://api.reddit.com/r/formula1/comments/11vq76l/2023_saudi_arabian_grand_prix_race_discussion/',
                'https://api.reddit.com/r/formula1/comments/129dvvg/2023_australian_grand_prix_post_race_discussion/',
                'https://api.reddit.com/r/formula1/comments/133o178/2023_azerbaijan_grand_prix_post_race_discussion/',
                'https://api.reddit.com/r/formula1/comments/13b2sc8/2023_miami_grand_prix_post_race_discussion/',
                'https://api.reddit.com/r/formula1/comments/13u2g56/2023_monaco_grand_prix_post_race_discussion/',
                'https://api.reddit.com/r/formula1/comments/140esk5/2023_spanish_grand_prix_post_race_discussion/',
                'https://api.reddit.com/r/formula1/comments/14ctc0l/2023_canadian_grand_prix_post_race_discussion/',
                'https://api.reddit.com/r/formula1/comments/14oprcg/2023_austrian_grand_prix_postrace_discussion/',
                'https://api.reddit.com/r/formula1/comments/14v1mc4/2023_british_grand_prix_postrace_discussion/',
                'https://api.reddit.com/r/formula1/comments/157gktr/2023_hungarian_grand_prix_postrace_discussion/',
                'https://api.reddit.com/r/formula1/comments/15dmykn/2023_belgian_grand_prix_postrace_discussion/',
                'https://api.reddit.com/r/formula1/comments/162tdrr/2023_dutch_grand_prix_postrace_discussion/',
                'https://api.reddit.com/r/formula1/comments/168yodr/2023_italian_grand_prix_postrace_discussion/',
                'https://api.reddit.com/r/formula1/comments/16l17fx/2023_singapore_grand_prix_postrace_discussion/',
                'https://api.reddit.com/r/formula1/comments/16qqikt/2023_japanese_grand_prix_postrace_discussion/',
                'https://api.reddit.com/r/formula1/comments/1736aot/2023_qatar_grand_prix_postrace_thread/',
                'https://api.reddit.com/r/formula1/comments/17e2qb7/2023_united_states_grand_prix_postrace_discussion/',
                'https://api.reddit.com/r/formula1/comments/17je0y4/2023_mexico_city_grand_prix_postrace_discussion/',
                'https://api.reddit.com/r/formula1/comments/17oizvd/2023_são_paulo_grand_prix_postrace_discussion/',
                'https://api.reddit.com/r/formula1/comments/17yrso4/2023_las_vegas_grand_prix_postrace_discussion/',
                'https://api.reddit.com/r/formula1/comments/184byfj/2023_abu_dhabi_grand_prix_postrace_thread/'
            ];

            const result = {};
            for (let i = 0; i < posts.length; i++) {
                result[`post_${i + 1}`] = await getSentimentRedditPost(posts[i]);
            }

            console.log('posts result => ', result);

            let positiveSentiment = [];
            let neutralSentiment = [];
            let negativeSentiment = [];

            for (let i = 0; i < posts.length; i++) {
                positiveSentiment.push(result?.[`post_${i + 1}`]?.['total']?.['positive']);
                neutralSentiment.push(result?.[`post_${i + 1}`]?.['total']?.['neutral']);
                negativeSentiment.push(result?.[`post_${i + 1}`]?.['total']?.['negative']);
            }

            const payloadStringify = JSON.stringify([
                {
                    data: positiveSentiment,
                    label: 'Positive',
                    borderColor: 'rgba(60, 179, 113, 1)',
                    borderWidth: 1,
                    fill: false
                },
                {
                    data: neutralSentiment,
                    label: 'Neutral',
                    borderColor: 'rgba(210, 210, 210, 1)',
                    borderWidth: 1,
                    fill: false
                },
                {
                    data: negativeSentiment,
                    label: 'Negative',
                    borderColor: 'rgba(255, 99, 71, 1)',
                    borderWidth: 1,
                    fill: false
                },
            ]);

            res.render('view-data', {payload: payloadStringify});
        } catch
            (error) {
            console.error('Error calculate sentiment...', error);
            res.status(500).json(error);
        }
    }
);

const getSentimentRedditPost = async (urlPost) => {
    try {
        const {WordTokenizer, SentimentAnalyzer, PorterStemmer} = natural;
        const axiosResponse = await axios.get(urlPost);
        console.log('response reddit => ', axiosResponse?.data);

        const sentiment = {
            positive: [],
            neutral: [],
            negative: []
        };

        for (const element of axiosResponse?.data) {
            for (const commentData of element?.data?.children) {
                const {body, permalink} = commentData?.data;
                if (body) {
                    console.log('clear comment... ', body);
                    const comment = aposToLexForm(body)?.toLowerCase()?.replace('/[^a-zA-Z\\s]+/g', '');

                    console.log('Splitting comments word by tokenizer...');
                    const tokenizer = new WordTokenizer();
                    const tokenizedReview = tokenizer.tokenize(comment);
                    tokenizedReview.forEach((word, index) => tokenizedReview[index] = spellCorrector.correct(word));

                    console.log('remove stop words from comment...');
                    const filteredReview = SW.removeStopwords(tokenizedReview);

                    console.log('setting sentiment lib...');
                    const analyzer = new SentimentAnalyzer('English', PorterStemmer, 'afinn');
                    const analysis = analyzer.getSentiment(filteredReview);

                    // Se il sentiment non è un numero viene scartato...
                    if (isNaN(analysis)) {
                        continue;
                    }

                    if (analysis > 0) {
                        sentiment.positive.push({permalink, analysis});
                    } else if (analysis === 0) {
                        sentiment.neutral.push({permalink, analysis});
                    } else {
                        sentiment.negative.push({permalink, analysis});
                    }
                }
            }
        }

        sentiment['total'] = {
            positive: sentiment.positive?.length,
            neutral: sentiment.neutral?.length,
            negative: sentiment.negative?.length
        }
        return sentiment;

    } catch (error) {
        throw error;
    }
}

module.exports = router;
