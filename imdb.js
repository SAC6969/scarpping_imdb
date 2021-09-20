let puppeteer = require("puppeteer");
let cheerio = require("cheerio");
let request = require("request-promise");

let fs = require("fs");
let path = require("path");
let PDFDocument = require('pdfkit');

let currDir = process.cwd();
let moviePath = path.join(currDir,"Movie")
if(!fs.existsSync(moviePath)){
    fs.mkdirSync(moviePath)
}

(async function fn(){
    let browser = await puppeteer.launch({
        headless : false,
        defaultViewport : null,
        args : ["--start-maximized", "--disable-notification"]
    });

    page = await browser.newPage();
    await page.goto("https://www.imdb.com/");
    
    await page.click("#imdbHeader-navDrawerOpen--desktop");
    
    await page.waitForSelector(".ipc-list-item__text");
    let loginwithImdb = await page.$$(".ipc-list-item__text");
    await page.evaluate( function cb(element){
        return element.click();
    },loginwithImdb[3]);

    await page.waitForSelector(".lister-list");

    let allPages = await browser.pages();
    let link = allPages[1].url();
    await page.waitForSelector(".lister");
    await request(link, getMovieList);

    let genres_link = await page.$$('[class="subnav_item_main"]>a');
    for(let i=0; i<genres_link.length; i++){
        let action = await page.evaluate( function cb(el){
            return el.getAttribute('href')
        },genres_link[i]);
        let actionPageLink = `https://www.imdb.com${action}`;
        await request(actionPageLink,getMovieGenres);
    }
})();


async function getMovieList(error, response, html) {
    if (error) {
        console.log(error);
    } else if (response.statusCode == 404) {
        console.log("page not found");
    } else {
        // console.log(html)
        await getMovieLink(html);
    }
}

let folderName;
async function getMovieLink(html) {
    let searchTool = cheerio.load(html);

    let folder = searchTool("h1[class='header']").text();
    folderName = path.join(moviePath,folder);
    if(!fs.existsSync(folderName)){
        fs.mkdirSync(folderName)
    }

    let element = searchTool(".lister-list tr");
    for(let i=0; i<element.length; i++){
        let trData = searchTool(element[i]).find("td");
        let movieLink = searchTool(trData[1]).find('a').attr("href");
        let movieLinkList = `https://www.imdb.com${movieLink}`;
        console.log(movieLinkList);
        await request(movieLinkList, movieLinkForDetails);
    }
}

async function getMovieGenres(error, response, html) {
    if (error) {
        console.log(error);
    } else if (response.statusCode == 404) {
        console.log("page not found");
    } else {
        // console.log(html)
        await getMovieGenresLink(html);
    }
}

async function getMovieGenresLink(html) {
    let searchTool = cheerio.load(html);

    let folder = searchTool("h1[class='header']").text();
    folderName = path.join(moviePath,folder);
    if(!fs.existsSync(folderName)){
        fs.mkdirSync(folderName)
    }

    let element = searchTool(".lister-item-header");
    for(let i=0; i<element.length; i++){
        let movieLink = searchTool(element[i]).find('a').attr("href");
        let movieLinkList = `https://www.imdb.com${movieLink}`;
        await request(movieLinkList, movieLinkForDetails);
    }
}


async function movieLinkForDetails(error, response, html) {
    if (error) {
        console.log(error);
    } else if (response.statusCode == 404) {
        console.log("page not found");
    } else {
        await getMovieDetails(html);
    }
}

async function getMovieDetails(html) {
    let searchTool = cheerio.load(html);

    let content = [];

    //Movie Name
    let movieName = searchTool('h1[data-testid="hero-title-block__title"]').text();
    console.log(movieName);

    //Description
    let movieDesription = searchTool(".GenresAndPlot__TextContainerBreakpointL-cum89p-1.gwuUFD").text();
    // console.log("movie Discription: "+ movieDesription);

    let releasedate = searchTool('li[data-testid="title-details-releasedate"]>div[class="ipc-metadata-list-item__content-container"]').text();
    // console.log(releasedate);

    let countriesofOrigin = searchTool('li[data-testid="title-details-origin"]>div[class="ipc-metadata-list-item__content-container"]').text();
    // console.log(countriesofOrigin);

    let language = searchTool('li[data-testid="title-details-languages"]>div[class="ipc-metadata-list-item__content-container"]').text();
    // console.log(language);

    //genres
    let GenresArr = searchTool(".GenresAndPlot__GenreChip-cum89p-3.fzmeux.ipc-chip.ipc-chip--on-baseAlt");
    let genres = "";
    for(let i = 0; i<GenresArr.length ;i++){
        genres += searchTool(GenresArr[i]).text() + "* ";
    }
    // console.log(genres)

    //director and write
    let dandW = searchTool('div[class="ipc-metadata-list-item__content-container"]');
    let director = searchTool(dandW[0]).text();
    // console.log("Director: "+director);

    let writer = searchTool(dandW[1]).text();
    // console.log("writer: "+writer);

    let obj = {
        movieName,
        movieDesription,
        releasedate,
        countriesofOrigin,
        language,
        genres,
        director,
        writer
    }
    content.push(obj);
    await makePdf(content,movieName);
}

async function makePdf(content,movieName){
    let pdfDoc = new PDFDocument;
    let moviePdf = path.join(folderName,`${movieName}.pdf`);
    pdfDoc.pipe(fs.createWriteStream(moviePdf));
    
    pdfDoc.fontSize(25).text(content[0].movieName,{ align: 'center'})
    pdfDoc.font('Courier').fontSize(13).text(content[0].movieDesription,{ align: 'center'})
    pdfDoc.text(" ");
    pdfDoc.font('Courier-Bold').fontSize(10).text("Release Date: "+content[0].releasedate,{ align: 'center'})
    pdfDoc.text("Countries of origin: "+content[0].countriesofOrigin,{ align: 'center'})
    pdfDoc.text("language: "+content[0].language,{ align: 'center'})
    pdfDoc.text("Genres: "+content[0].genres,{ align: 'center'})
    pdfDoc.text("Director: "+content[0].director,{ align: 'center'})
    pdfDoc.text("Writer: "+content[0].writer,{ align: 'center'})
    pdfDoc.end()
    console.log()
}
