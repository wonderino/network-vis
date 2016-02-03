var egoNetworks = d3.egoNetworks()
  .egoIndex('1499879597')//('242998577')
  .sortKey('type')
  .degreeMax(130)
  .sortType('string')
  .nodeKey('user_id')
  .valueKey(null)
  .isDirected(true);
d3.json('data/instastar.json', function(_err,_data) {
  if(_err) {console.log(_err)}
  else {

    d3.select('.content.instastar')
      .datum(_data)
      .call(egoNetworks)
    /*
    setTimeout(function(){
      egoNetworks.changeColorKey('occupation')
    }, 5000)
    */
    d3.select('.search.inputs > input[type="search"]')
      .call(setKeyInteraction);
  }
})

function setKeyInteraction(_selection) {
  var _submit = function() {
    var ul = d3.select('.search.results > ul');
    var selected = ul.selectAll('li.selected');
    var datum;
    if (selected.size() == 0) {
      datum = ul.selectAll('li:first-child').datum();
    } else {
      datum = selected.datum();
    }
    // delete results;
    d3.select('.search.inputs > input[type="search"]')
      .property('value', '');
    ul.selectAll('li')
      .remove();
    egoNetworks.ego(datum);
    d3.select('.search.results').classed('hidden', true);
  }
  _selection.on('keyup', function() {
    if (d3.event.keyCode == 13) { //return
      //change the network and remove ;
      var ul = d3.select('.search.results > ul');
      if (ul.selectAll('li').size() == 0) return false;
      _submit();
      // transfer the datum to the network;
    } else if (d3.event.keyCode == 40) { //down
      var ul = d3.select('.search.results > ul');
      var selected = ul.selectAll('li.selected');
      if(selected.size() == 0) {
        ul.selectAll('li:first-child')
          .classed('selected', true);
      } else {
        ul.selectAll('li.selected + li')
          .classed('selected', true);
        selected.classed('selected', false);
      }
      return false;
    } else if (d3.event.keyCode == 38) { //up
      var ul = d3.select('.search.results > ul');
      var selected = ul.selectAll('li.selected');
      if(selected.size() == 0) {
        ul.selectAll('li:last-child')
          .classed('selected', true);
      } else {
        selected.classed('after-selected', true);
        ul.selectAll('li.selected ~ li')
          .classed('after-selected', true);
        var before = ul.selectAll('li:not(.after-selected)')
          before.filter(function(d,i) {
            return (i === before.size()-1)
          }).classed('selected', true);
        selected.classed('selected', false);
        ul.selectAll('li.after-selected')
          .classed('after-selected', false);
      }
    } else { //
      //do search and show the list;
      var query = d3.select(this).node().value;
      var ul = d3.select('.search.results > ul');
      query = query.trim();
      if(query=='') {
        d3.select('.search.results').classed('hidden', true);
        return;
      }
      var results = egoNetworks.search(query);
      var li = ul.selectAll('li')
        .data(results);
      var liEnter = li.enter().append('li')
      liEnter.append('span').attr('class','name');
      liEnter.append('span').attr('class','desc');
      li.select('.name').text(function(d){return d['ent_name']});
      li.select('.desc').text(function(d){return ((d['team'] && d['team'] !== '-') ? d['team'] : d['occupation'])});
      li.on('mouseenter', function(d){
        ul.selectAll('li.selected')
          .classed('selected', false);
        d3.select(this).classed('selected', true);
      }).on('click', function(d) {
        _submit();
      })
      li.exit().remove();
      if (li.size()>0) d3.select('.search.results').classed('hidden', false);
    }
    d3.event.returnValue = false
    return false;
  })
  return _selection;
}
