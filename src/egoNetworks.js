d3.egoNetworks = function module() {
  var attrs = {
    width: 400,
    height:400,
    egoIndex:0
  }
  var margin = {top:10, right:10, bottom:10, left:10}
  var innerWidth, innerHeight;
  var svg;

  var exports = function (_selection) {
    _selection.each(function(_data) {
      if(!svg) {
        d3.select(this).style('width', attrs.width + 'px')
          .style('height', attrs.height + 'px')
        innerWidth = attrs.width - margin.left - margin.right;
        innerHeight = attrs.height - margin.top - margin.bottom;

        svg = d3.select(this).append('svg')
          .attr('width', attrs.width)
          .attr('height', attrs.height)
          .append('g')
          .attr('transform', d3.svg.transform().translate([margin.left, margin.top]))
      }
      svg.datum(_data)
        .call(egoInit)
    })
  }

  function egoInit(_selection) {
    _selection.each(function(d) {
      var egoAndNeighbors = {ego:getCurEgo(d.nodes), neighbors:getNeighbors(d)};
      /*
      TODO
        [x] 1. neighbors 구하기
        2. ego의 degree 값 구하기
        3. ego와 neighbor 그리기 (절대값은?)
        4. (옵션) distant 2 까지 그리기?
        5. 이웃 node 클릭시 새롭게 이동? -> 1로 다시
      */
    })
  }
  function getNeighbors(_data) {
    var neighbors = []
    _data.links.forEach(function(l,i) {
      if (attrs.egoIndex == l.source) {
        neighbors.push({neighbor:_data.nodes[l.target], link:l, neighborIndex:l.target})
      } else if (attrs.egoIndex == l.target) {
        neighbors.push({neighbor:_data.nodes[l.source], link:l, neighborIndex:l.source})
      }
    })
    return neighbors;
  }

  function getCurEgo(nodes) {
    return nodes[attrs.egoIndex]
  }

  function accessor(_attr) {
    return function(value) {
      if(!value) return attrs[_attr]
      attrs[_attr] = value;
      return exports;
    }
  }

  for (var attr in attrs) {
    if(attrs.hasOwnProperty(attr)) {
      exports[attr] = accessor(attr);
    }
  }

  return exports;
}
